wizard = (function() {
    /*
     * Private
     */

    /*
     * Wizard needs data to vizualize dataviz configuration
     * each data sample linked to dataviz is stored for next usage
     * in _satoreData and active dataviz data is stored in _data
     */

    var _data;

    var _storeData = {};

    /*
    * ExistingConfig is a dataviz
    * conf herited of composition report
    * this var is used by wizard to initiate itself with existing conf
    */

    var _existingConfig = false;

    /* Method to extract a set of data in relation with dataviz
    * and necessary to configure and visualize a dataviz for a report
    * Result is stored in _data variable & in _storeData[xxx] to reuse it later
    */
    var _getSampleData = function(datavizId) {
        // function countUnique is used to test if labels linked to dataviz are unique or not.
        function countUnique(iterable) {
          return new Set(iterable).size;
        }
        //get sample data linked to dataviz, format it and store it for later
        $.ajax({
            dataType: "json",
            type: "GET",
            url: [report.getAppConfiguration().api, "store", datavizId, "data/sample"].join("/"),
            success: function (data) {
                if (data.data) {
                    //update local data
                    var tmp_data = {"dataset":{}};
                    var formatedData = {
                        "dataset": [],
                        "data": [],
                        "label":[],
                        "rows":0,
                        "significative_label": false
                    };
                    //test multilines and format data and populate formatedData
                    if (data.data.length === 1) {
                        //eg figure : data = {"data":"1984","dataset":"bigbrother","label":"Roman de G. Orwell","order":1}
                        var a = data.data[0];
                        formatedData = {"dataset": [a.dataset], "data": [a.data], "label":[a.label], "rows":1, "significative_label": true};
                    } else {
                        /* eg graph with 2 datasets: data = [
                            {"data":"10","dataset":"voitures","label":"2019","order":1},
                            {"data":"15","dataset":"voitures","label":"2020","order":2},
                            {"data":"12","dataset":"vélos","label":"2019","order":1},
                            {"data":"13","dataset":"vélos","label":"2020","order":2}
                        ]
                           or graph with one dataset  : data = [
                            {"data":"75%","dataset":"budget","label":"disponible","order":1},
                            {"data":"25%","dataset":"budget","label":"dépensé","order":2}
                           ]
                        */
                        data.data.forEach(function(item) {
                            if (tmp_data.dataset[item.dataset]) {
                                tmp_data.dataset[item.dataset].data.push(item.data);
                                tmp_data.dataset[item.dataset].label.push(item.label);
                            } else {
                                tmp_data.dataset[item.dataset] = {
                                    "data": [item.data],
                                    "label": [item.label]
                                };
                                formatedData.dataset.push(item.dataset);
                            }
                        });
                        /* if more than one dataset store data and labels in this model :
                         *   [
                                [dataset1.value1, dataset1.value2],
                                [dataset2.value1, dataset2.value2]
                            ]
                        */
                        if (formatedData.dataset.length > 1) {
                            formatedData.dataset.forEach(function(dataset) {
                                formatedData.data.push(tmp_data.dataset[dataset].data);
                                formatedData.label.push(tmp_data.dataset[dataset].label);
                            });
                            formatedData.rows = formatedData.data[0].length;
                            // Test if labels are significative. If then labels can be used as column in table dataviz
                            formatedData.significative_label = (countUnique(formatedData.label[0]) > 1);

                        } else {
                            /* Put directly data and labels from the unique dataset
                                [value1, value2]
                            */
                            formatedData.data = tmp_data.dataset[formatedData.dataset[0]].data;
                            formatedData.label = tmp_data.dataset[formatedData.dataset[0]].label;
                            formatedData.rows = formatedData.data.length;
                            // Test if labels are significative. If then labels can be used as column in table dataviz
                            formatedData.significative_label = (countUnique(formatedData.label[0]) > 1);
                        }
                    }

                    _data = formatedData;
                    _storeData[datavizId] = formatedData;
                    _configureWizardOptions();

                } else {
                    console.log("Erreur : Impossible de récupérer l'échantillon de données : " + data);
                }
            },
            error: function (xhr, status, error) {
                console.log(error);
            }
        });
    };

    /*
    * _clean Method to clear wizard form
    */

    var _clean = function () {
        $("#dataviz-attributes").hide();
        //remove existing result
        $("#wizard-result div").remove();
        //remove all form values
        $(".dataviz-attributes").val("");
        $("#w_dataviz_type").val("");
        $("#wizard-code").text("");
    };

    /*
    * Method to configure wizard options with dataviz capabilities
    * Update options in select control #w_dataviz_type"
    */
    var _configureWizardOptions = function() {
        // TODO REFACTOR THIS
        var dataset_nb = _data.dataset.length;
        var data_nb = _data.rows;
        var data_type = "text";
        var significative_label = _data.significative_label;
        if (_data.dataset.length === 1) {
            var _url = new RegExp(/^((http[s]?|ftp):\/)?\/?([^:\/\s]+)((\/\w+)*\/)([\w\-\.]+[^#?\s]+)(.*)?(#[\w\-]+)?$/);
            if (_url.test(_data.data[0])) {
                data_type = "url";
            }
            if (_data.data[0] && _data.data[0].startsWith("POINT")) {
                data_type = "geom";
            }
        } else {
            if (_data.data[0] && _data.data[0][0] && _data.data[0][0].startsWith("POINT")) {
                data_type = "geom";
            }
        }

        var options = [];
        if (data_type === "geom") {
            options.push(["map", "fas fa-map-marker-alt"]);
        }
        // Many datasets => table, chart
        if (dataset_nb > 1) {
            options.push(["table", "fas fa-table"]);
            if (significative_label) {
                options.push(["chart","fas fa-chart-bar"]);
            }
        } else {
            if (data_nb === 1) {
                // 1 dataset une seule ligne => figure, text, iframe, image
                if (data_type === "text") {
                    options.push(["figure", "fas fa-sort-numeric-down"]);
                    options.push(["text", "far fa-file-alt"]);
                } else if (data_type === "url") {
                    options.push(["iframe", "far fa-map"]);
                    options.push(["image", "far fa-image"]);
                }
            } else {
                // 1 dataset plusieurs lignes => table, chart
                options.push(["chart","fas fa-chart-bar"]);
                // un seul dataset but significative label
                if (significative_label) {
                    options.push(["table", "fas fa-table"]);
                }
            }
        }
        var dataviz_options = ['<option class="dataviz-options" selected disabled>...</option>'];
        options.forEach(function(option) {
            dataviz_options.push('<option  data-icon="'+option[1]+'" class="dataviz-options" value="' + option[0] + '">' + option[0] + '</option>');
        });

        $("#w_dataviz_type .dataviz-options").remove();
        $("#w_dataviz_type").append(dataviz_options.join(""));

        $("#indicateur-metadata").html("<code>" + [dataset_nb + " datasets disponible(s)",
                data_nb + " lignes",
                "Labels utilisables " + significative_label
            ].join("<br>") + "</code>");

        $("#wizard-panel").attr("metadata-datasets", dataset_nb);
        $("#wizard-panel").attr("metadata-rows", data_nb);
        $("#wizard-panel").attr("metadata-significative-label", significative_label);


    };

    /*
    * Method to automaticaly set dataviz parameters in #wizard-parameters form
    * this method is called by  _onChangeDatavizType linked to w_dataviz_type change event
    */
    _autoConfig = function(dataviz) {
        var colors = composer.colors() || ["#e55039", "#60a3bc", "#78e08f", "#fad390"];
        //significative label if is true, allow chart and extra column in table
        var significative_label = _data.significative_label;
        var nb_datasets = _data.dataset.length;
        var columns = [];
        for (var i = 0; i < nb_datasets; i++) {
            columns.push(i + 1);
        }

        switch (dataviz) {
            case "chart":
                // chart parameters
                $("#w_chart_opacity").val("0.75");
                // set chart type
                $("#w_chart_type").val("bar");
                $("#w_colors").val(colors.slice(0, nb_datasets).join(","));
                // set chart label(s)
                if (nb_datasets === 1) {
                    $("#w_label").val("Légende");
                } else {
                    $("#w_label").val(_data.dataset.join(","));
                }
                break;
            case "table":
                // set table headers
                $("#w_label").val(_data.dataset.join(","));
                //select columns (datasets) to render tin table
                $("#w_table_column").val(columns.join(","));
                if (significative_label) {
                    $("#w_table_extracolumn").val("#");
                    //show extra columns parameters
                    _enableExtraColumnParameter(true);
                } else {
                     //hide extra columns parameters
                    $("#w_table_extracolumn").closest(".input-group").hide();
                }
                break;

        }
    };

    //show or hide  extra columns parameters
    _enableExtraColumnParameter = function (enable) {
        if (enable) {
            $("#w_table_extracolumn").closest(".input-group").show();
        } else {
            $("#w_table_extracolumn").closest(".input-group").hide();
        }
    }

    /*
    * Apply dataviz conf from composition report.
    . By this way on open wizard, dataviz is directly rendered
    */

    _applyDatavizConfig = function (cfg) {
        // get all dataviz parameters from dataviz configuration
        $("#w_dataviz_type").val(cfg.dataviz_type);
        $("#w_colors").val(cfg.colors);
        $("#w_label").val(cfg.label);
        $("#w_title").val(cfg.title);
        $("#w_desc").val(cfg.description);
        if (cfg.icon) {
            $("#w_icon").val(cfg.icon);
        }
        //show fields linked to dataviz type (table, figure, chart...)
        _showParameters(cfg.dataviz_type);
        if (cfg.dataviz_type === "chart") {
            $("#w_chart_opacity").val(cfg.opacity);
            $("#w_chart_type").val(cfg.type);
        } else if (cfg.dataviz_type === "table") {
            $("#w_table_column").val(cfg.columns);
            if (cfg.extracolumn) {
                //show and set extracolumn parameter
                 _enableExtraColumnParameter(true);
                 $("#w_table_extracolumn").val(cfg.extracolumn);
            } else {
                //hide extracolumn parameter
                _enableExtraColumnParameter(false);
            }

        }
    }

    /*
    * _configureDataviz. This method get dataviz definition in wizard and put it in dataviz-definition
    * in the report composition
    */

    var _configureDataviz = function (datavizId) {
        //Get current dataviz id
        var datavizId = $("#wizard-panel").attr("data-related-id");
        //copy paste generated code in <code> element
        $('[data-dataviz="'+ datavizId +'"] code.dataviz-definition').text($("#wizard-code").text());
        //get dataviz type
        var datavizType = $("#w_dataviz_type").val();
        var ico = $("#w_dataviz_type option:selected").attr("data-icon");
        //update dataviz element icon (chart for chart, table for table...)
        $('[data-dataviz="'+ datavizId +'"] button i').get( 0 ).className = ico;
        //Tag dataviz element as yet configured
        $('[data-dataviz="'+ datavizId +'"] button').closest(".tool").addClass("configured");
        //Reset and hide wizard modal
        $("#wizard-result div").remove();
        $("#wizard-code").text("");
        $("#wizard-panel").modal("hide");
    };

    // this method shows fields linked to dataviz type (table, figure, chart...)
    var _showParameters = function (dataviz) {
        $("#dataviz-attributes").show();
        $(".dataviz-attributes").closest(".input-group").hide();
        $("." + dataviz + ".dataviz-attributes").closest(".input-group").show();
        if (dataviz === "chart") {
            $("#w_label").closest(".input-group").find(".input-group-text").text("séries");
        } else if (dataviz === "table") {
            $("#w_label").closest(".input-group").find(".input-group-text").text("labels");
        }
        $("#w_icon").val("icon-default");

    };

    /*
     * _onChangeDatavizType. This method is linked to #w_dataviz_type select control event change
     *
     */
    var _onChangeDatavizType = function() {
        // get dataviz representation type
        var dataviz = $("#w_dataviz_type").val();
        //Reset dataviz parameters form
        $(".dataviz-attributes").val("");
        //Show fields linked to dataviz type
        _showParameters(dataviz);
        // automaticaly set dataviz parameters in #wizard-parameters form
        _autoConfig(dataviz);
        _existingConfig = false;
        //Refresh dataviz renderer
        $("#wizard_refresh").click();
    };

    /*
     * _onWizardOpened. This method is linked to open wizard modal event.
     *
     */

    var _onWizardOpened = function (e) {
        //Get datavizid linked to the wizard modal
        var datavizId = $(e.relatedTarget).attr('data-related-id');
        //Set datavizid in the modal
        $(e.currentTarget).attr("data-related-id", datavizId);
        $(e.currentTarget).find(".modal-title").text(datavizId);
        //clear wizard form;
        _clean();
        //Get data linked to dataviz
        if (_storeData[datavizId]) {
            _data = _storeData[datavizId];
            //check if configuration exists for this dataviz with attributes. eg data-colors...
            var yetConfigured = $(e.relatedTarget).closest(".dataviz").find("code.dataviz-definition").text() || false;
            if (yetConfigured){
                //Get the config
                var _code = $($.parseHTML(yetConfigured)).find(".dataviz");
                _existingConfig = $(_code).data();
                // Get dataviz type (hugly !)
                // check class linked to dataviz - eg : from class report-chart" --> extract chart
                $(_code).attr("class").split(" ").forEach(function (cls) {
                    var t = cls.split("report-");
                    if (t.length === 2) {
                        _existingConfig.dataviz_type = t[1];
                    }
                })
            } else {
                _existingConfig = false;
            }
            //configure wizard options with dataviz capabilities
            _configureWizardOptions();
            //Apply config if exists
            if (_existingConfig) {
                _applyDatavizConfig(_existingConfig);
                //Render dataviz in result panel
                setTimeout(_onValidateConfig, 500);
            }
        } else {
            //download data for this dataviz
            _getSampleData(datavizId);
        }


    };

    /*
     * _onValidateConfig. This method is get values from wizard parameters
     * and populate a config object passed to the report.testViz method.
     * Used by #wizard_refresh button and the auto render method in _onWizardOpened
     *
     */

    var _onValidateConfig = function () {
        var dataviz = $("#wizard-panel").attr("data-related-id");
        var type = $("#w_dataviz_type").val();
        if (type) {
            var attributes = [];
            var properties = {
                "id": dataviz
            };
            $(".dataviz-attributes").each(function(id, attribute) {
                var val = $(attribute).val();
                var prop = $(attribute).attr("data-prop");
                if (val && val.length >= 1) {
                    attributes.push("data-" + prop + '="' + val + '"');
                    attributes.push({"prop" : prop, "value": val});
                    properties[prop] = val;
                }
            });
            ["colors", "label"].forEach(function(prop) {
                if (properties[prop]) {
                    properties[prop] = properties[prop].split(",");
                }
            });

            ["columns"].forEach(function(prop) {
                if (properties[prop]) {
                    properties[prop] = properties[prop].split(",").map(function(val) {
                        return Number(val) - 1;
                    });
                }
            });

            /* sample properties : {
                "id":"magasins",
                "type":"bar",
                "opacity":"0.75",
                "label":["Ouvert","Fermé"],
                "colors":["#3db39e","#999999"]
            } */
            //Get dataviz component herited from template and set attributes with properties object
            var elem = $.parseHTML(composer.activeModel().dataviz_components[type].replace("{{dataviz}}", dataviz));
            attributes.forEach(function(attribute) {
                $(elem).find(".dataviz").attr("data-" + attribute.prop, attribute.value);    
            });

            //set icon class from icon attribute for figures components
            var icon = $(elem).find(".dataviz").attr("data-icon");
            if (icon && type === "figure" ) {
                var figure = $(elem).find(".dataviz")[0];
                //remove existing icon class eg icon-default
                figure.classList.forEach(className => {
                    if (className.startsWith('icon-')) {
                        figure.classList.remove(className);
                    }
                });
                //add icon class
                figure.classList.add(icon);
                figure.classList.add("custom-icon");
            }
            //Render result in wizard modal
            $("#wizard-result div").remove();
            $("#wizard-result").append(elem);
            $("#wizard-code").text(elem[0].outerHTML);
            var fdata = {};
            fdata[dataviz] = _data;
            //Draw dataviz with data, type and properties
            report.testViz(fdata, type, properties);
        }
    };



    var _init = function() {
        //load wizard html dynamicly and append it admin.html
        $.ajax({
            url: "html/wizard.html",
            dataType: "text",
            success: function(html) {
                $("body").append(html);
                //Events management
                $('#wizard-panel').on('show.bs.modal', _onWizardOpened);
                $("#w_dataviz_type").change( _onChangeDatavizType);
                $("#wizard_refresh").click(_onValidateConfig);
            }
        });

    };




    /*
     * Public
     */

    return {

        init: _init,
        configureDataviz: _configureDataviz
    }; // fin return

})();