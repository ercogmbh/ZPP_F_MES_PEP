/*
 * IN ACTIVE DEVELOPMENT
 * 1) this.getView().getController() construction should be removed due to strong dependency to controller (which library should not have)
 * 2) openpopups for cells should be in another lib\view
 */
sap.ui.define([
	"MIND2PEP_PLANNER/utils/Formatter",
	"MIND2PEP_PLANNER/utils/Helper"
], function (Formatter, Helper) {
	"use strict";

	return {
		/* PRIVATE */
		oView: null,
		setView: function (view) {
			this.oView = view;
		},
		getView: function () {
			return this.oView;
		},
		/* END PRIVATE */

		/* UNIT TABLE */
		fillUnitColumns: function (oTable, vUnitKey) {
			var oFilterUnit = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			this.getView().getModel().read("/metaUnitSet", { //TODO: THIS
				groupId: vUnitKey,
				success: function (oData) {
					this.readMetaUnitSuccess(oTable, vUnitKey, oData); //TODO: THIS
				}.bind(this),
				error: function (oError) {
					oTable.setBusy(false);
				}.bind(this),
				filters: [oFilterUnit]
			});
		},
		readMetaUnitSuccess: function (oTable, vUnitKey, oData) {
			var aData = oData.results;

			if (aData) {

				for (var i = 0; i < aData.length; i++) {

					var oTemplate;

					if (aData[i].ColumnType === "BUTTON") {
						oTemplate = new sap.m.Button({
							text: {
								path: aData[i].FieldKey + "/value"
							},
							tooltip: {
								path: aData[i].FieldKey + "/Tooltip"
							},
							// enabled: "{= !${readonly}}",
							press: this.getView().getController().openPopup.bind(this.getView().getController()),
							width: "100%",
							type: sap.m.ButtonType.Transparent,
							enabled: {
								parts: [aData[i].FieldKey + "/disabled", "readonly"],
								formatter: function (vValue, readonly) {
									return !(vValue || readonly);
								}
							}
						}).addStyleClass("sapMButtonText");

						oTemplate.addCustomData(new sap.ui.core.CustomData({
							key: "EmpID",
							writeToDom: true,
							value: {
								path: aData[i].FieldKey + "/EmpID",
								formatter: Formatter.checkCustomDataIsString
							}
						}));

						oTemplate.addCustomData(new sap.ui.core.CustomData({
							key: "UnitKey",
							writeToDom: true,
							value: vUnitKey
						}));

						oTemplate.addCustomData(new sap.ui.core.CustomData({
							key: "fragment",
							writeToDom: true,
							value: {
								path: aData[i].FieldKey + "/fragment",
								formatter: Formatter.checkCustomDataIsString
							}
						}));

					} else if (aData[i].FieldKey === "UNASSIGN") {
						oTemplate = new sap.m.Button({
							text: {
								path: aData[i].FieldKey + "/value"
							},
							tooltip: {
								path: aData[i].FieldKey + "/Tooltip"
							},
							visible: "{= !${readonly}}",
							press: this.getView().getController().unassignEmployee.bind(this.getView().getController()),
							width: "100%",
							type: sap.m.ButtonType.Reject,
							enabled: {
								path: aData[i].FieldKey + "/disabled",
								formatter: function (vValue) {
									return !vValue;
								}
							}
						});

						oTemplate.addCustomData(new sap.ui.core.CustomData({
							key: "EmpID",
							writeToDom: true,
							value: {
								path: aData[i].FieldKey + "/EmpID",
								formatter: Formatter.checkCustomDataIsString
							}
						}));

						oTemplate.addCustomData(new sap.ui.core.CustomData({
							key: "UnitKey",
							writeToDom: true,
							value: vUnitKey
						}));

						oTemplate.addCustomData(new sap.ui.core.CustomData({
							key: "fragment",
							writeToDom: true,
							value: {
								path: aData[i].FieldKey + "/fragment",
								formatter: Formatter.checkCustomDataIsString
							}
						}));
					} else {
						oTemplate = new sap.m.Text({
							text: {
								path: aData[i].FieldKey + "/value"
							},
							tooltip: {
								path: aData[i].FieldKey + "/Tooltip"
							},
							wrapping: false
						});
					}

					oTemplate.addEventDelegate({
						onBeforeRendering: this.onBeforeRenderTemplate
					});

					oTemplate.addEventDelegate({
						onAfterRendering: this.onAfterRenderTemplate
					});

					oTemplate.addCustomData(new sap.ui.core.CustomData({
						key: "background",
						writeToDom: true,
						value: {
							path: aData[i].FieldKey + "/color",
							formatter: Formatter.checkCustomDataIsString
						}
					}));

					var oColumn = new sap.ui.table.Column("col_" + vUnitKey + aData[i].FieldKey, {
						template: oTemplate,
						autoResizable: true
					});

					var oUnitLabel = new sap.m.Label("lbl_unit" + vUnitKey + i);

					oUnitLabel.setWidth("1px");

					if (i === 0) {
						oUnitLabel.setTextAlign(sap.ui.core.TextAlign.Center);
						oUnitLabel.setWidth("100%");
						oUnitLabel.setDesign(sap.m.LabelDesign.Bold);
						oColumn.setHeaderSpan([aData.length, 1]);
					}
					var oFieldLabel = new sap.m.Label("lbl_" + vUnitKey + aData[i].FieldKey);
					oFieldLabel.setText(aData[i].FieldLabel);
					oColumn.addMultiLabel(oUnitLabel);

					oColumn.setWidth(aData[i].ColumnWidth);

					oColumn.addMultiLabel(oFieldLabel);
					oTable.addColumn(oColumn);
				}
				this.readDateUnit(oTable, vUnitKey);
				oTable.setFixedColumnCount(aData.length);
			} else {
				this.readDateUnit(oTable, vUnitKey);
			}
		},
		readDateUnit: function (oTable, vUnitKey) {
			var oModel = this.getView().getModel();
			var oCalendar;

			if (this.getView().byId("cal_timeframe").getVisible()) { //TODO: THIS
				oCalendar = this.getView().byId("cal_timeframe"); //TODO: THIS
			} else {
				oCalendar = this.getView().byId("cal_interval"); //TODO: THIS
			}

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
				var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

				oModel.read("/commentSet", {
					filters: [oFilter, oUnitFilter],
					success: function (oData) {
						var oCommentModel = this.getView().getModel("Comments"); //TODO: THIS
						oCommentModel.setData(oData, true);
					}.bind(this),
					error: function () {}
				});

				oModel.read("/metaDateSet", {
					groupId: vUnitKey,
					filters: [oFilter, oUnitFilter],
					success: function (oData) {
						this.readMetaDateSuccess(oTable, vUnitKey, oData);
					}.bind(this),
					error: function (oData) {
						oTable.setBusy(false);
					}
				});
			}
		},
		readMetaDateSuccess: function (oTable, vUnitKey, oData) {
			var aData = oData.results;
			if (aData) {
				if (aData.length > 0) {
					var vCurDate = aData[0].PlanDate;
					for (var i = 0; i < aData.length; i++) {

						var oDate = new Date(aData[i].PlanDate);
						oDate.setHours(12);
						var vDate = Date.parse(oDate.toString());

						var oDateLabel = new sap.m.FormattedText("lbl_date" + vUnitKey + aData[i].FieldKey + vDate, {
							width: "100%"
						});

						if (this.checkHasComment(vDate, vUnitKey)) {
							var cLetter = this.getResourceBundleText("letter");
							oDateLabel.setHtmlText(
								"<p style='color:#2648B2;text-align:center;font-weight:bolder;margin-block-start:0px;margin-block-end:0px;font-size:1rem'>" +
								aData[i].LabelText + cLetter + "</p>");
						} else {
							oDateLabel.setHtmlText(
								"<p style='text-align:center;font-weight:bold;margin-block-start:0px;margin-block-end:0px;font-size:1rem'>" + aData[i].LabelText +
								"</p>");
							//use <br> tags for line breaks
							//example:
							// oDateLabel.setHtmlText("<p style='text-align:center;font-weight:bold;margin-block-start:0px;margin-block-end:0px'>" + aData[i].LabelText +
							// 	"<br>" + "Münster Geist" + "<br>" + "Frühtermin" + "</p>"); //use <br> tags for line breaks
						}

						var oTemplate;

						if (aData[i].ColumnType === "BUTTON") {
							oTemplate = new sap.m.Button({
								text: {
									path: aData[i].FieldKey + vDate + "/value"
								},
								tooltip: {
									path: aData[i].FieldKey + vDate + "/Tooltip"
								},
								// enabled: "{= !${readonly}}",
								press: this.getView().getController().openPopup.bind(this.getView().getController()),
								width: "100%",
								type: sap.m.ButtonType.Transparent,
								enabled: {
									parts: [aData[i].FieldKey + vDate + "/disabled", "readonly"],
									formatter: function (vValue, readonly) {
										return !(vValue || readonly);
									}
								}
							}).addStyleClass("sapMButtonText");

							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "EmpID",
								writeToDom: true,
								value: {
									path: aData[i].FieldKey + vDate + "/EmpID",
									formatter: Formatter.checkCustomDataIsString
								}
							}));

							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "PlanDate",
								writeToDom: true,
								value: vDate.toString()
							}));

							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "UnitKey",
								writeToDom: true,
								value: vUnitKey
							}));

							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "fragment",
								writeToDom: true,
								value: {
									path: aData[i].FieldKey + vDate + "/fragment",
									formatter: Formatter.checkCustomDataIsString
								}
							}));
							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "ColumnType",
								writeToDom: true,
								value: "Button"
							}));

						} else if (aData[i].ColumnType === "TEXT") {
							oTemplate = new sap.m.Text({
								text: {
									path: aData[i].FieldKey + vDate + "/value"
								},
								tooltip: {
									path: aData[i].FieldKey + vDate + "/Tooltip"
								},
								// visible: "{= !${readonly}}",
								wrapping: false
							});
							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "ColumnType",
								writeToDom: true,
								value: "Text"
							}));

						} else if (aData[i].ColumnType === "CB") {
							oTemplate = new sap.m.ComboBox({
								selectedKey: {
									path: aData[i].FieldKey + vDate + "/value"
								},
								tooltip: {
									path: aData[i].FieldKey + vDate + "/Tooltip"
								},
								visible: "{= !${readonly}}",
								change: this.getView().getController().onCBSubmit.bind(this.getView().getController()),
								width: "5rem" // ursprünglich 4rem
							});

							this.getView().getController()._oDataUtil.getItems(aData[i].FieldKey, vUnitKey, oTemplate).then(function (oResult) {
								var oItem = {};
								for (var k = 0; k < oResult.aItems.length; k++) {
									oItem = oResult.aItems[k];
									oResult.oTemplate.addItem(new sap.ui.core.Item({
										key: oItem.ItemKey,
										text: oItem.ItemValue,
										tooltip: oItem.ItemTooltip
									}));
								}
							});

							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "EmpId",
								writeToDom: true,
								value: {
									path: aData[i].FieldKey + vDate + "/EmpID",
									formatter: Formatter.checkCustomDataIsString
								}
							}));

							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "PlanDate",
								writeToDom: true,
								value: vDate.toString()
							}));
							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "FieldKey",
								writeToDom: true,
								value: aData[i].FieldKey
							}));
							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "defKey",
								writeToDom: true,
								value: {
									path: aData[i].FieldKey + vDate + "/value",
									mode: "OneTime",
									formatter: Formatter.checkCustomDataIsString
								}
							}));
							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "UnitKey",
								writeToDom: true,
								value: vUnitKey
							}));
							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "ColumnType",
								writeToDom: true,
								value: "CB"
							}));

						} else {
							oTemplate = new sap.m.Text({
								text: {
									path: aData[i].FieldKey + vDate + "/value"
								},
								tooltip: {
									path: aData[i].FieldKey + vDate + "/Tooltip"
								},
								// visible: "{= !${readonly}}",
								wrapping: false
							});
							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "ColumnType",
								writeToDom: true,
								value: "Text"
							}));
						}

						oTemplate.addEventDelegate({
							onBeforeRendering: this.getView().getController().onBeforeRenderTemplate
						});

						oTemplate.addEventDelegate({
							onAfterRendering: this.getView().getController().onAfterRenderTemplate
						});

						oTemplate.addCustomData(new sap.ui.core.CustomData({
							key: "background",
							writeToDom: true,
							value: {
								path: aData[i].FieldKey + vDate + "/color",
								formatter: Formatter.checkCustomDataIsString
							}
						}));

						var oColumn = new sap.ui.table.Column("Dcol_" + vUnitKey + aData[i].FieldKey + vDate, {
							template: oTemplate,
							autoResizable: true
						});

						oColumn.addCustomData(new sap.ui.core.CustomData({
							key: "UnitKey",
							writeToDom: true,
							value: vUnitKey
						}));

						oColumn.addCustomData(new sap.ui.core.CustomData({
							key: "PlanDate",
							writeToDom: true,
							value: vDate.toString()
						}));

						oDateLabel.setWidth("1px");

						if (vCurDate.toString() !== aData[i].PlanDate.toString() || i === 0) {
							vCurDate = aData[i].PlanDate;
							var vFieldCount = 0;
							oDateLabel.setWidth("100%");

							for (var j = 0; j < aData.length; j++) {
								if (aData[j].PlanDate.toString() === vCurDate.toString()) {
									vFieldCount++;
								}
							}
							oColumn.setHeaderSpan([vFieldCount, 1]);

						}
						var oFieldLabel = new sap.m.Label("lbl_" + vUnitKey + aData[i].FieldKey + vDate);
						oFieldLabel.setText(aData[i].FieldLabel);
						oColumn.addMultiLabel(oDateLabel);

						oColumn.setWidth(aData[i].ColumnWidth);

						oColumn.addMultiLabel(oFieldLabel);
						oTable.addColumn(oColumn);

					}

				}
			}
			this.setTableData(oTable, vUnitKey);
			this.setupTabHandling(oTable);
		},
		setTableData: function (oTable, vUnitKey) {
			var oBegda = this.getView().getController().getSelectedBegda();
			var oEndda = this.getView().getController().getSelectedEndda();
			var oFilterDate = new sap.ui.model.Filter("PlanDate", sap.ui.model.FilterOperator.BT, oBegda, oEndda);
			var oFilterUnit = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

			this.getView().getModel().read("/planDataSet", {
				groupId: vUnitKey,
				filters: [oFilterDate, oFilterUnit],
				success: function (oData) {
					this.readPlanDataSuccess(oTable, vUnitKey, oData);
				}.bind(this),
				error: function () {
					this.handleError(this, oTable); //yannick
				}.bind(this),
				// refreshAfterChange: true
				refreshAfterChange: false
			});
		},
		readPlanDataSuccess: function (oTable, vUnitKey, oData) {
			var mViewData = {
				rows: []
			};

			var oModel = new sap.ui.model.json.JSONModel();

			var aData = oData.results;
			if (aData && aData.length > 0) {
				var oRows = {};
				aData.forEach(function (item) {
					var oDate = new Date(item.PlanDate);
					if (oDate.getYear() == "8099") {
						var vDate = "";
					} else {
						oDate.setHours(12);
						var vDate = Date.parse(oDate.toString());
					}

					var sPernr = item.EmpId,
						vLine = item.Line;

					if (!oRows[sPernr + vLine]) {
						oRows[sPernr + vLine] = {
							EmpID: sPernr,
							Line: vLine
						};
					}

					var oRow = oRows[sPernr + vLine];

					vLine !== "001" ? oRow.readonly = true : oRow.readonly = false;

					oRow[item.FieldKey + vDate] = {};
					oRow[item.FieldKey + vDate].value = item.FieldValue;
					oRow[item.FieldKey + vDate].Tooltip = item.FieldToolTip;
					oRow[item.FieldKey + vDate].color = item.FieldBColor;
					oRow[item.FieldKey + vDate].disabled = item.Disabled;
					oRow[item.FieldKey + vDate].fragment = item.Fragment;
					oRow[item.FieldKey + vDate].EmpID = sPernr;
				});

				Object.keys(oRows).forEach(function (item) {
					mViewData.rows.push(oRows[item]);
				});

				oModel.setData({
					modelData: mViewData
				});

				oTable.setModel(oModel);

				oTable.bindAggregation("rows", {
					path: "/modelData/rows"
				});

				var oContent = oTable.getBinding("rows");

				this.setRowCount(oTable, mViewData.rows);

				if (!this.getView().getController().isFeatureEnabled("EXPANDED")) {
					oTable.setBusy(true);
					setTimeout(function () {
						Helper.autoResize(oTable);
					}, 0);
				} else if (this.getView().getController().isFeatureEnabled("EXPANDED") && oTable.getVisible()) {
					oTable.setBusy(true);
					setTimeout(function () {
						Helper.autoResize(oTable);
					}, 0);
				}

			} else {
				oTable.setBusy(false);
			}
		},
		/* END UNIT TABLE */

		/* SUM TABLE */
		fillSumTable: function (oTable, vUnitKey) {
			var oModel = this.getView().getModel();
			var oCalendar;

			oTable.setBusy(true);

			if (this.getView().byId("cal_timeframe").getVisible()) {
				oCalendar = this.getView().byId("cal_timeframe");
			} else {
				oCalendar = this.getView().byId("cal_interval");
			}

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
			if (oBegda && oEndda) {

				oTable.setBusy(true);
				var oTimeframeFilter = new sap.ui.model.Filter("PlanDate", sap.ui.model.FilterOperator.BT, oBegda, oEndda);
				var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
				oModel.read("/sumMetaDataSet", {
					groupId: vUnitKey,
					filters: [oTimeframeFilter, oUnitFilter],
					success: this.sumMetaSuccess.bind(this.getView().getController(), oTable, vUnitKey),
					error: function () {
						oTable.setBusy(false);
					}.bind(this)
				});
			}
		},
		sumMetaSuccess: function (oTable, vUnitKey, oData, Response) {
			var aData = oData.results;
			var oTable = oTable;

			for (var i = 0; i < aData.length; i++) {
				var oLabel = new sap.m.Label();
				var oDate = new Date(aData[i].PlanDate);
				if (oDate.getYear() == "8099") {
					oLabel.setText(aData[i].FieldLabel);
				} else {
					oLabel.setText(aData[i].LabelText);
				}
				var vDate = Date.parse(oDate.toString());

				var oText = new sap.m.Text({
					text: {
						path: vDate.toString()
					},
					visible: {
						path: vDate.toString() + "ShowMsg",
						formatter: function (vValue) {
							return !vValue;
						}
					}
				});

				var oButton = new sap.m.Button({
					visible: {
						path: vDate.toString() + "ShowMsg"
					},
					text: {
						path: vDate.toString() + "MsgCnt"
					},
					type: sap.m.ButtonType.Transparent,
					icon: "sap-icon://message-popup",
					press: this.getView().getController().showSumMsg.bind(this.getView().getController(), oDate, vUnitKey)
				}).addStyleClass("btnText");

				oButton.addCustomData(new sap.ui.core.CustomData({
					key: "sumkey",
					writeToDom: true,
					value: {
						path: vDate.toString() + "SumKey",
						formatter: Formatter.checkCustomDataIsString
					}
				}));

				var oTemplate = new sap.ui.layout.HorizontalLayout({
					content: [oText, oButton]
				});

				oTemplate.addEventDelegate({
					onAfterRendering: this.onAfterRenderTemplate
				});

				oTemplate.addCustomData(new sap.ui.core.CustomData({
					key: "background",
					writeToDom: true,
					value: {
						path: vDate.toString() + "FieldBColor",
						formatter: Formatter.checkCustomDataIsString
					}
				}));

				var oColumn = new sap.ui.table.Column("Scol_" + vUnitKey + aData[i].FieldKey + vDate, {
					template: oTemplate,
					autoResizable: true
				});

				oColumn.setLabel(oLabel);
				oColumn.setWidth(aData[i].ColumnWidth || "auto");
				oTable.addColumn(oColumn);
			}
			this.fillSumData(oTable, vUnitKey);
		},
		fillSumData: function (oTable, vUnitKey) {
			if (this.getView().getController().getSelectedEndda() == null) {
				return;
			}
			var oModel = this.getView().getModel();
			var oBegda = this.getView().getController().getSelectedBegda();
			var oEndda = this.getView().getController().getSelectedEndda();
			oBegda.setUTCDate(oBegda.getDate());
			oEndda.setUTCDate(oEndda.getDate());

			var oTimeframeFilter = new sap.ui.model.Filter("PlanDate", sap.ui.model.FilterOperator.BT, oBegda, oEndda);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			oModel.read("/sumDataSet", {
				groupId: vUnitKey + "sds",
				filters: [oTimeframeFilter, oUnitFilter],
				success: function (oData) {
					this.getView().getController().sumDataSuccess(oTable, vUnitKey, oData);
				}.bind(this.getView().getController()),
				error: function (oError) {
					oTable.setBusy(false);
				}.bind(this)
			});
		},
		sumDataSuccess: function (oTable, vUnitKey, oData) {
			var aData = oData.results;
			var oSumData = {};
			var mViewData = {
				rows: []
			};
			var oModel = new sap.ui.model.json.JSONModel();
			var vSumKey;
			for (var i = 0; i < aData.length; i++) {
				//new line
				if (i !== 0 && vSumKey !== aData[i].SumKey) {
					mViewData.rows.push(oSumData);
					oSumData = {};
				}
				vSumKey = aData[i].SumKey;
				var oDate = new Date(aData[i].PlanDate);
				var vDate = Date.parse(oDate.toString());

				oSumData[vDate.toString()] = aData[i].Value;
				var vPath = vDate.toString() + "ShowMsg";
				oSumData[vPath] = aData[i].ShowMsg;
				vPath = vDate.toString() + "MsgCnt";
				oSumData[vPath] = aData[i].MessageCount;
				vPath = vDate.toString() + "SumKey";
				oSumData[vPath] = aData[i].SumKey;
				vPath = vDate.toString() + "FieldBColor";
				oSumData[vPath] = aData[i].FieldBColor;

			}
			if (aData.length > 0) {
				mViewData.rows.push(oSumData);
			}
			oModel.setData({
				modelData: mViewData
			});
			oTable.setModel(oModel);
			oTable.bindAggregation("rows", {
				path: "/modelData/rows"
			});
			this.setRowCount(oTable, mViewData.rows);

			setTimeout(function () {
				Helper.autoResize(oTable);
			}, 500);

		},
		/* END SUM TABLE */

		/* TABLE UTILS */
		checkHasComment: function (vDate, vUnitKey) {
			var oCommentModel = this.getView().getModel("Comments");
			var oDate = new Date(vDate);
			var bContains = false;

			$.each(oCommentModel.getData().results, function (id, data) {
				data.PlanDate.setHours(12);
				if (data.PlanDate.toString() === oDate.toString() && data.UnitKey === vUnitKey) {
					bContains = true;
				}
			});
			return bContains;
		},
		setupTabHandling: function (oTable) {
			oTable.addEventDelegate({
				onAfterRendering: function () {
					var i;
					var oTableID = oTable.getId();
					var oRows = oTable.getRows();
					$("#" + oTableID).focusin(function () {
						// remember current focused cell
						jQuery.sap.delayedCall(100, null, function () {
							var oBody = $('#' + oTableID).find('tbody');
							// find the focused input field
							var oField = oBody.find('.sapMFocus')[0];
							if (oField) {
								// store ID of focused cell
								this._FieldID = oField.id;
							}
						}.bind(this));
					}.bind(this));

					$('#' + oTableID).on('keyup', function (e) {
						var oSelectedField = sap.ui.getCore().byId(this._FieldID);
						var oRow = oSelectedField.getParent();
						var oCells = oRow.getCells();
						var aInputs = []; // all input fields per row
						var firstInput = 0; // first input field in row
						var lastInput = 0; // last input field in row

						// get index of first and last input fields of table row
						for (i = 0; i < oCells.length; i++) {
							if (oCells[i]._$input) {
								aInputs.push(i);
								if (!firstInput) {
									firstInput = i;
								}
								lastInput = i;
							}
						}

						var oTargetCell, thisInput, thisRow, targetIndex;

						// on TAB press - navigate one field forward

						if (e.which == 9 && !e.shiftKey) {
							// get index of currently focused field
							thisInput = oCells.indexOf(oCells.filter(function (entry) {
								return entry.getId() === this._FieldID;
							}.bind(this))[0]);

							// is field last input in row?
							if (thisInput === lastInput) {
								// jump to next row
								thisRow = oRows.indexOf(oRows.filter(function (entry) {
									return entry.getId() === oRow.getId();
								})[0]);

								// is row last visible row on screen?
								if (thisRow === oTable.getRows().length - 1) {
									// last visible row - scroll one row down and keep focus
									oTable._scrollNext();
									jQuery.sap.delayedCall(100, null, function () {
										var oTargetCell = oRows[thisRow].getCells()[firstInput];
										oTargetCell.focus();
									});
								} else {
									// not last visible row - set focus in next row
									oTargetCell = oRows[thisRow + 1].getCells()[firstInput];
									oTargetCell.focus();
								}

							} else {
								// no row jump - focus next input cell in this row
								targetIndex = 0;
								for (i = 0; i < aInputs.length; i++) {
									if (aInputs[i] === thisInput) {
										// next entry is target cell
										targetIndex = aInputs[i + 1];
									}
								}
								oTargetCell = oRow.getCells()[targetIndex];
								oTargetCell.focus();
							}
						}
						// On SHIFT + TAB press - navigate one field backward
						if (e.which == 9 && e.shiftKey) {
							// get index of currently focused field
							thisInput = oCells.indexOf(oCells.filter(function (entry) {
								return entry.getId() === this._FieldID;
							}.bind(this))[0]);

							// is field first input in row?
							if (thisInput === firstInput) {
								// jump to previous row
								thisRow = oRows.indexOf(oRows.filter(function (entry) {
									return entry.getId() === oRow.getId();
								})[0]);

								// is row first visible row on screen?
								if (thisRow === 0) {
									// first visible row - scroll one row up and keep focus
									oTable._scrollPrevious();
									jQuery.sap.delayedCall(100, null, function () {
										var oTargetCell = oRows[thisRow].getCells()[lastInput];
										oTargetCell.focus();
									});
								} else {
									// not last visible row - set focus in previous row
									oTargetCell = oRows[thisRow - 1].getCells()[lastInput];
									oTargetCell.focus();
								}

							} else {
								// no row jump - focus previous input cell in this row
								targetIndex = 0;
								for (i = 0; i < aInputs.length; i++) {
									if (aInputs[i] === thisInput) {
										// next entry is target cell
										targetIndex = aInputs[i - 1];
									}
								}
								oTargetCell = oRow.getCells()[targetIndex];
								oTargetCell.focus();
							}
						}
						if (oTargetCell) {
							oTargetCell.selectText(0, oTargetCell.getValue().length);
						}
					}.bind(this));
				}.bind(this)
			}, oTable);
		},
		setRowCount: function (oTable, aRows) {
			var vLength = aRows.length;
			switch (this.getView().getController().isFeatureEnabled("ROWCOUNT")) {
			case true:
				if (vLength < this.getView().getController().oUserCust.Nooflines) {
					oTable.setVisibleRowCount(vLength);
				} else {
					oTable.setVisibleRowCount(this.getView().getController().oUserCust.Nooflines);
				}
				break;
			case false:
				if (vLength < this.getView().getController().oCustomizing.PlanVisRows) {
					oTable.setVisibleRowCount(vLength);
				} else {
					oTable.setVisibleRowCount(this.getView().getController().oCustomizing.PlanVisRows);
				}
				break;
			default:
				if (vLength < this.getView().getController().oCustomizing.PlanVisRows) {
					oTable.setVisibleRowCount(vLength);
				} else {
					oTable.setVisibleRowCount(this.getView().getController().oCustomizing.PlanVisRows);
				}
			}
		},

		addCssColoring: function (color) {
			var sStyle = "",
				aStyles = this.getView()._aStyles,
				template = "[data-background='" + color + "']";
				template += ", " + template + " > .sapMInputBaseContentWrapper";

			if (!aStyles) {
				this.getView()._aStyles = [];
				aStyles = this.getView()._aStyles;
			}

			if (aStyles.indexOf(template) !== -1) {
				return;
			}
			aStyles.push(template);
			sStyle = template + ' {background: ' + color + ' !important} ';
			Helper.addStyleClass(sStyle);
		},
		addHeaderCssColoring: function (color) {
			var sStyle = "",
				aHeaderStyles = this.getView()._aStyles,
				template = "[data-header-background='" + color + "']";
				template += ", " + template + " > .sapMInputBaseContentWrapper";

			if (!aHeaderStyles) {
				this.getView()._aStyles = [];
				aHeaderStyles = this.getView()._aStyles;
			}

			if (aHeaderStyles.indexOf(template) !== -1) {
				return;
			}
			aHeaderStyles.push(template);
			sStyle = template + ' {background: ' + color + ' !important} ';
			Helper.addStyleClass(sStyle);
		}
		/* END TABLE UTILS */
	};
});