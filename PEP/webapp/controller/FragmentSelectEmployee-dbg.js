sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"MIND2PEP_PLANNER/utils/Helper"
], function (Controller, Helper) {
	"use strict";

	return Controller.extend("MIND2PEP_PLANNER.controller.FragmentSelectEmployee", {
		parent: null,

		constructor: function (oParent, vUnitKey) {
			this.oParent = oParent;
			this.vUnitKey = vUnitKey;

			return Controller.call(this);
		},

		createEmpTable: function () {
			// sap.ui.getCore().byId("btn_emp_add").attachPress(this.addEmployee.bind(this));
			// sap.ui.getCore().byId("btn_add_emp_search").attachPress(this._setEmpTableData.bind(this));
			this.oTable = sap.ui.getCore().byId("tbl_emp_selection");
			this.oTable.destroyColumns();
			this.oTable.unbindAggregation("rows");
			this._fillEmpUnitColumns();
		},

		_fillEmpUnitColumns: function () {
			var oFilterUnit = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, this.vUnitKey);
			this.oParent.getView().getModel().read("/metaEmpUnitSet", {
				groupId: this.vUnitKey,
				success: function (oData) {
					this._readMetaEmpUnitSuccess(oData.results);
				}.bind(this),
				error: function () {
					this.oTable.setBusy(false);
				}.bind(this),
				filters: [oFilterUnit],
				refreshAfterChange: true
			});
		},

		_readMetaEmpUnitSuccess: function (aData) {
			if (aData) {
				for (var i = 0; i < aData.length; i++) {

					var oTemplate = new sap.m.Text({
						text: {
							path: "value"
						},
						tooltip: {
							path: "Tooltip"
						},
						wrapping: false
					});

					oTemplate.addEventDelegate({
						onBeforeRendering: this.oParent.onBeforeRenderTemplate
					});

					oTemplate.addEventDelegate({
						onAfterRendering: this.oParent.onAfterRenderTemplate
					});

					oTemplate.addCustomData(new sap.ui.core.CustomData({
						key: "background",
						writeToDom: true,
						value: {
							path: "color"
						}
					}));

					oTemplate.bindElement(aData[i].FieldKey);

					var oColumn = new sap.ui.table.Column({
						template: oTemplate,
						autoResizable: true
					});

					var oUnitLabel = new sap.m.Label();

					oUnitLabel.setWidth("auto");

					if (i === 0) {
						oUnitLabel.setTextAlign(sap.ui.core.TextAlign.Center);
						oUnitLabel.setWidth("auto");
						oUnitLabel.setDesign(sap.m.LabelDesign.Bold);
						oColumn.setHeaderSpan([aData.length, 1]);
					}
					var oFieldLabel = new sap.m.Label();
					oFieldLabel.setText(aData[i].FieldLabel);
					oColumn.addMultiLabel(oUnitLabel);
					oColumn.setWidth("auto");
					oColumn.addMultiLabel(oFieldLabel);
					this.oTable.addColumn(oColumn);
				}
				this._fillEmpDateColumns();
				this.oTable.setFixedColumnCount(aData.length);
			} else {
				this._fillEmpDateColumns();
			}
		},

		_fillEmpDateColumns: function () {
			var oCalendar;
			oCalendar = sap.ui.getCore().byId("cal_date_int");

			var aSelectedDates = oCalendar.getSelectedDates();
			if (aSelectedDates.length > 0) {
				var oBegda1 = aSelectedDates[0].getStartDate();
				var oEndda1 = aSelectedDates[0].getEndDate();
				if (oEndda1 == null) {
					return;
				}
				var oBegda = new Date(oBegda1);
				var oEndda = new Date(oEndda1);
				oBegda.setHours(12);
				oEndda.setHours(12);
				oBegda.setUTCDate(oBegda.getDate());
				oEndda.setUTCDate(oEndda.getDate());
			}
			//Wenn nur das Begindatum gewählt ist wollen wir keinen Aufruf ans Backend starten
			if (oBegda && oEndda) {
				var oFilter = new sap.ui.model.Filter("PlanDate", sap.ui.model.FilterOperator.BT, oBegda, oEndda);
				var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, this.vUnitKey);

				this.oParent.getView().getModel().read("/metaEmpDateSet", {
					groupId: this.vUnitKey,
					filters: [oFilter, oUnitFilter],
					success: function (oData) {
						this._readMetaEmpDateSuccess(oData.results);
					}.bind(this),
					error: function () {
						//todo: this.oTable.setBusy(false);
					},
					refreshAfterChange: true
				});
			}
		},

		_readMetaEmpDateSuccess: function (aData) {
			if (aData) {
				if (aData.length > 0) {
					var vCurDate = aData[0].PlanDate;
					for (var i = 0; i < aData.length; i++) {
						var oDate = new Date(aData[i].PlanDate);
						var vDate = Date.parse(oDate.toString());

						var oDateLabel = new sap.m.FormattedText({
							width: "100%"
						});
						oDateLabel.setHtmlText(
							"<p style='text-align:center;font-weight:bold;margin-block-start:0px;margin-block-end:0px;font-size:1rem'>" + aData[i].LabelText +
							"</p>");

						var oTemplate;

						oTemplate = new sap.m.Text({
							text: {
								path: "value"
							},
							tooltip: {
								path: "Tooltip"
							},
							wrapping: false
						});
						oTemplate.addCustomData(new sap.ui.core.CustomData({
							key: "ColumnType",
							writeToDom: true,
							value: "Text"
						}));

						// oTemplate.addEventDelegate({
						// 	//onBeforeRendering: this.oParent.onBeforeRenderTemplate
						// });

						oTemplate.addEventDelegate({
							onAfterRendering: this.oParent.onAfterRenderTemplate
						});

						oTemplate.addCustomData(new sap.ui.core.CustomData({
							key: "background",
							writeToDom: true,
							value: {
								path: "color"
							}
						}));

						oTemplate.bindElement(aData[i].FieldKey + vDate);
						var oColumn = new sap.ui.table.Column({
							template: oTemplate,
							autoResizable: true
						});

						oColumn.addCustomData(new sap.ui.core.CustomData({
							key: "UnitKey",
							writeToDom: true,
							value: this.vUnitKey
						}));

						oColumn.addCustomData(new sap.ui.core.CustomData({
							key: "PlanDate",
							writeToDom: true,
							value: vDate.toString()
						}));

						oDateLabel.setWidth("auto");

						if (vCurDate.toString() !== aData[i].PlanDate.toString() || i === 0) {
							vCurDate = aData[i].PlanDate;
							var vFieldCount = 0;
							oDateLabel.setWidth("auto");

							for (var j = 0; j < aData.length; j++) {
								if (aData[j].PlanDate.toString() === vCurDate.toString()) {
									vFieldCount++;
								}
							}
							oColumn.setHeaderSpan([vFieldCount, 1]);

						}
						var oFieldLabel = new sap.m.Label();
						oFieldLabel.setText(aData[i].FieldLabel);

						oColumn.addMultiLabel(oDateLabel);

						oColumn.setWidth("auto");
						oColumn.addMultiLabel(oFieldLabel);

						this.oTable.addColumn(oColumn);

					}

				}
			}
		},

		closeSelectDialog: function (oEvent) {
			this.oParent.closeSelectDialog(oEvent);
		},

		handleCalendarSelect: function () {
			var oSelectedBegda = this.oParent.getSelectedBegda(
				"cal_date_int");
			var oSelectedEndda = this.oParent.getSelectedEndda(
				"cal_date_int");
			if (oSelectedBegda === undefined || oSelectedEndda === undefined) {
				return;
			}
			this.createEmpTable();
			this.oParent.loadQualsInAddEmployee(this.vUnitKey);
		},

		//Button Eventhandler
		onFilterSearchButtonPress: function (oEvent) {
			this._setEmpTableData(oEvent);
		},
		onSearchEmpName: function (oEvent) {
			if (sap.ui.getCore().byId("sf_emp_name").getValue() !== "") {
				this._setEmpTableData(oEvent);
			}

		},

		onDateChange: function (oEvent) {
			oEvent.getSource().getDateValue().setHours(12);
			var oRangeBegda = sap.ui.getCore().byId("dp_begda");
			var oBegdaValue = oRangeBegda.getDateValue();
			var oRangeEndda = sap.ui.getCore().byId("dp_endda");
			var oEnddaValue = oRangeEndda.getDateValue();

			oRangeBegda.setValueState("None");
			oRangeEndda.setValueState("None");
			oRangeBegda.setMaxDate(oRangeEndda.getDateValue());
			oRangeEndda.setMinDate(oRangeBegda.getDateValue());

			if (oBegdaValue === "") {
				oRangeBegda.setValueState("Error");
				return -1;
			}

			if (oEnddaValue === "") {
				oRangeEndda.setValueState("Error");
				return -1;
			}

			if (oBegdaValue > oEnddaValue) {
				oRangeBegda.setValueState("Error");
				oRangeEndda.setValueState("Error");
				return -1;
			}

			return 0;

		},

		onAddEmpButtonPress: function () {
			var oEmpTable = sap.ui.getCore().byId("tbl_emp_selection");
			if (oEmpTable.getSelectedIndex() === -1) {
				return;
			}

			this.oParent.addEmployee(this.vUnitKey);
		},

		_setEmpTableData: function (oEvent) {
			var oModel = this.oParent.getView().getModel();
			var oBox;
			var i;
			var aFilters = [];
			var aItems;
			var oFilter;
			var aCustomData;
			var vEventId = oEvent.getId();
			var oSearchField = sap.ui.getCore().byId("sf_emp_name");
			var vEmpName;

			this.oTable.setBusy(true);
			//this.oTable.destroyRows();
			switch (vEventId) {
			case "search":
				vEmpName = oSearchField.getValue();
				if (vEmpName !== "") {
					oFilter = new sap.ui.model.Filter("EmpName", sap.ui.model.FilterOperator.EQ, vEmpName);
					aFilters.push(oFilter);
				}
				break;
			case "press":
				vEmpName = "";
				break;
			case "select":
				this._fillEmpDateColumns();
				vEmpName = "";
				break;
			default:
				return;
			}

			if (this.oParent.oEmployeeFilterCust.EmpQualAvailable) {
				oBox = sap.ui.getCore().byId("vb_qual");
				aItems = oBox.getItems();
				for (i = 0; i < aItems.length; i++) {
					if (aItems[i].getProperty("selected") === true) {
						aCustomData = aItems[i].getAggregation("customData");
						oFilter = new sap.ui.model.Filter("EmpQual", sap.ui.model.FilterOperator.EQ, Helper.getCustomDataValue(aCustomData,
							"qualid"));
						aFilters.push(oFilter);

					}
				}
				var oMCB = sap.ui.getCore().byId("mcb_quals");
				aItems = oMCB.getSelectedKeys();
				for (i = 0; i < aItems.length; i++) {
					oFilter = new sap.ui.model.Filter("EmpQual", sap.ui.model.FilterOperator.EQ, aItems[i]);
					aFilters.push(oFilter);
				}
			}

			if (this.oParent.oEmployeeFilterCust.EmpSgAvailable) {
				var oSG = sap.ui.getCore().byId("mcb_sg");
				aItems = oSG.getSelectedKeys();
				for (i = 0; i < aItems.length; i++) {
					oFilter = new sap.ui.model.Filter("EmpShiftGroup", sap.ui.model.FilterOperator.EQ, aItems[i]);
					aFilters.push(oFilter);
				}
			}

			if (this.oParent.oEmployeeFilterCust.EmpAvailAvailable) {
				oBox = sap.ui.getCore().byId("vb_av");
				aItems = oBox.getItems();
				var vKey;
				for (i = 0; i < aItems.length; i++) {
					if (aItems[i].getProperty("selected") === true) {
						aCustomData = aItems[i].getAggregation("customData");
						vKey = Helper.getCustomDataValue(aCustomData, "AvailKey");
						oFilter = new sap.ui.model.Filter("EmpAvail", sap.ui.model.FilterOperator.EQ, vKey);
						aFilters.push(oFilter);
					}
				}
			}

			var oSelectedBegda = this.oParent.getSelectedBegda();
			var oSelectedEndda = this.oParent.getSelectedEndda();
			if (oSelectedEndda == null || oSelectedEndda == undefined) {
				return;
			}
			var oPlanBegda = this.oParent.getSelectedBegda(
				"cal_date_int");
			var oPlanEndda = this.oParent.getSelectedEndda(
				"cal_date_int");

			if (oPlanEndda == null || oPlanEndda == undefined) {
				this.oParent._oAddEmployeeDialog.setBusy(false);
				return;
			}

			oSelectedBegda.setUTCDate(oSelectedBegda.getDate());
			oSelectedEndda.setUTCDate(oSelectedEndda.getDate());
			oPlanBegda.setUTCDate(oPlanBegda.getDate());
			oPlanEndda.setUTCDate(oPlanEndda.getDate());

			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.NE, this.vUnitKey);
			var oPlanBegdaFilter = new sap.ui.model.Filter("PlanBegda", sap.ui.model.FilterOperator.EQ, oSelectedBegda);
			var oPlanEnddaFilter = new sap.ui.model.Filter("PlanEndda", sap.ui.model.FilterOperator.EQ, oSelectedEndda);
			var oSelectBegdaFilter = new sap.ui.model.Filter("SelectBegda", sap.ui.model.FilterOperator.EQ, oPlanBegda);
			var oSelectEnddaFilter = new sap.ui.model.Filter("SelectEndda", sap.ui.model.FilterOperator.EQ, oPlanEndda);
			aFilters.push(oUnitFilter);
			aFilters.push(oPlanBegdaFilter);
			aFilters.push(oPlanEnddaFilter);
			aFilters.push(oSelectBegdaFilter);
			aFilters.push(oSelectEnddaFilter);

			oModel.read("/assignedEmployeesSet", {
				filters: aFilters,
				success: function (oData) {
					this._readEmpDataSuccess(oData.results);
				}.bind(this),
				error: function (oError) {
					this.oTable.setBusy(false);
					this.oParent.handleError(this, this.oTable);
				}.bind(this),
				refreshAfterChange: true
			});
		},

		_readEmpDataSuccess: function (aData) {
			var mViewData = {
				rows: []
			};

			var oModel = new sap.ui.model.json.JSONModel();

			var mRowData = {};
			var vDate;
			var vPernr = "";
			var vLine = "";
			if (aData && aData.length > 0) {
				for (var i = 0; i < aData.length; i++) {
					//Neue Zeile
					if (vPernr !== aData[i].EmpId || vLine !== aData[i].Line) {
						if (i !== 0) {
							mRowData["EmpId"] = vPernr;
							mViewData.rows.push(mRowData);
						}
						mRowData = {};
						vPernr = aData[i].EmpId;
						vLine = aData[i].Line;
					}

					var oDate = new Date(aData[i].PlanDate);
					//Für Mitarbeiterspalten, diese sind nicht ssbezogen, werden im Backend mit Highdate versorgt
					//Javascript Highdate ist wiederrum 8099 :) 
					if (oDate.getYear() == "8099") {
						vDate = "";
					} else {
						vDate = Date.parse(oDate.toString());
					}

					mRowData[aData[i].FieldKey + vDate] = {};
					mRowData[aData[i].FieldKey + vDate].value = aData[i].FieldValue;
					mRowData[aData[i].FieldKey + vDate].Tooltip = aData[i].FieldToolTip;
					mRowData[aData[i].FieldKey + vDate].color = aData[i].FieldBColor;
					mRowData[aData[i].FieldKey + vDate].disabled = aData[i].Disabled;
					mRowData[aData[i].FieldKey + vDate].fragment = aData[i].Fragment;
					mRowData[aData[i].FieldKey + vDate].EmpID = vPernr;
				}

				if (aData.length > 0) {
					mRowData["EmpId"] = vPernr;
					mViewData.rows.push(mRowData);
				}

				oModel.setData({
					modelData: mViewData
				});
				this.oTable.setModel(oModel);

				this.oTable.bindAggregation("rows", {
					path: "/modelData/rows"
				});

				var oContent = this.oTable.getBinding("rows");

				this.oParent.setRowCount(this.oTable, mViewData.rows);

				this.oTable.setBusy(false);
				setTimeout(function () {
					Helper.autoResize(this.oTable);
				}.bind(this), 500);

			} else {
				this.oTable.setBusy(false);
			}

		}

	});

});