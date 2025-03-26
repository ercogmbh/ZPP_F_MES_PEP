sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/MessageBox",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/MessageToast",
	"sap/ui/model/json/JSONModel",
	"MIND2PEP_PLANNER/utils/Formatter",
	"MIND2PEP_PLANNER/utils/Helper",
	"MIND2PEP_PLANNER/utils/DataUtil",
	"MIND2PEP_PLANNER/utils/Rptime",
	"MIND2PEP_PLANNER/utils/Tables",
	"MIND2PEP_PLANNER/utils/TimesOverview",
	"MIND2PEP_PLANNER/controls/customTable",
	"MIND2PEP_PLANNER/controller/FragmentSelectEmployee",
	"sap/m/ColumnListItem",
	"MIND2PEP_PLANNER/controller/FragmentQualPick",
	"MIND2PEP_PLANNER/controller/FragmentExportRosterPDF",
	"sap/m/Text",
	'sap/ui/core/Popup'
], function (Controller, MessageBox, Dialog, Button, MessageToast, JSONModel, Formatter, Helper, DataUtil, Rptime, Tables, TimesOverview,
	customTable,
	FragmentSelectEmployee, ColumnListItem, FragmentQualPick, FragmentExportRosterPDF, Text, Popup) {
	"use strict";

	var oMessageItem = new sap.m.MessageItem({
		type: {
			path: "severity",
			formatter: function (vValue) {
				switch (vValue) {
				case "error":
					return sap.ui.core.MessageType.Error;
				case "success":
					return sap.ui.core.MessageType.Success;
				case "warning":
					return sap.ui.core.MessageType.Warning;
				}
				return vValue;
			}
		},
		title: "{message}",
		description: "{message}",
		subtitle: "{message}"
	});

	var oMessagePopover = new sap.m.MessagePopover({
		items: {
			path: "/",
			template: oMessageItem
		}
	});

	return Controller.extend("MIND2PEP_PLANNER.controller.Main", {
		formatter: Formatter,
		libtables: Tables,

		onInit: function () {
			var oDataModel = this.getOwnerComponent().getModel(),
				that = this;
			oDataModel.metadataLoaded().then(function () {
				this.initializeModel();
				this._oDataUtil = DataUtil.getInstance(oDataModel);
				this._oRptime = Rptime.getInstance(oDataModel);
				this.aItems = [];
				this.readCustomizing();
				this.getUnits();
				// if (this.getUnits() === true) {

				// 	var oMessageModel = new sap.ui.model.json.JSONModel();
				// 	oMessagePopover.setModel(oMessageModel);
				// 	oMessagePopover.attachAfterClose(function () {
				// 		this.open = false;
				// 	}.bind(this));

				// 	this.libtables.setView(this.getView());

				// 	$(window).bind('beforeunload', this.checkChangesBeforeClose.bind(this));

				// } else {
				// 	return;
				// }
			}.bind(this));

			oDataModel.attachMetadataFailed(function () {
				MessageBox.error(that.getView().getModel("i18n").getResourceBundle().getText("MetadataLoadFailed"));
			});
		},

		onAfterRendering: function () {
			var oCal = this.byId('cal_interval');
			var callfunc = function () {
				Helper.attachCalendarWeekSelection($('.sapUiCalRowWeekNumbers')[0], oCal);
			};

			oCal.addEventDelegate({
				onAfterRendering: callfunc
			});
		},

		checkChangesBeforeClose: function (oEvent) {
			var message = this.getResourceBundleText("onbeforeunloadmessage");
			if (this.getView().getModel("CBData")) {
				var oCBDataModel = this.getView().getModel("CBData");
				if (oCBDataModel.getData().length > 0) {
					oEvent.returnValue = message;
					return message;
				}
			}
		},

		getUnits: function () {
			var oModel = this.getView().getModel();
			var dPlanBegda = this.getSelectedBegda();
			//Wenn dPlanBegda nicht gefüllt, ist der Kalender noch nicht initialisiert.
			//test change for igor
			if (!dPlanBegda) {
				dPlanBegda = new Date();
			}
			var vBegda = this.getFormattedDate(dPlanBegda);

			var dPlanEndda = this.getSelectedEndda();
			if (!dPlanEndda) {
				dPlanEndda = new Date(dPlanBegda.getTime() + 7 * 24 * 60 * 60 * 1000);
			}
			var vEndda = this.getFormattedDate(dPlanEndda);
			oModel.setHeaders({
				"planBegda": vBegda,
				"planEndda": vEndda
			});

			// var bSuccess = true;
			oModel.read("/unitSet", {
				success: function (oData) {
					this.aUnits = oData.results;
					$.when(this._oDataUtil.getData(this, this.aUnits)).then(function () {
						this.createUnitTables();
					}.bind(this));
					// return bSuccess;
					this.getUnitsSuccess();
				}.bind(this),
				error: function (oError) {
					var aErrorMsg = JSON.parse(oError.responseText).error.innererror.errordetails;
					MessageBox.error(aErrorMsg[0].message, {
						onClose: function () {
							this.getView().removeAllContent();
						}.bind(this)
					});
					return;
					// bSuccess = false;
					// return bSuccess;
				}.bind(this)
			});
		},

		getUnitsSuccess: function () {
			var oMessageModel = new sap.ui.model.json.JSONModel();
			oMessagePopover.setModel(oMessageModel);
			oMessagePopover.attachAfterClose(function () {
				this.open = false;
			}.bind(this));

			this.libtables.setView(this.getView());

			$(window).bind('beforeunload', this.checkChangesBeforeClose.bind(this));
		},

		createUnitTables: function () {
			var oDeferred = $.Deferred();
			var oModel = this.getView().getModel();
			var aPanels = [];
			var vTableVisibility;
			var oTitle;
			if (this.isFeatureEnabled("EXPANDED")) {
				vTableVisibility = false;
			} else {
				vTableVisibility = true;
			}

			if (!this._tables) this._tables = {};
			if (!this._tables.sum) this._tables.sum = {};
			if (!this._tables.unit) this._tables.unit = {};

			for (var i = 0; i < this.aUnits.length; i++) {
				if (sap.ui.getCore().byId("pnl" + this.aUnits[i].UnitKey)) {
					continue;
				}
				var vId = "tbl_plan_" + this.aUnits[i].UnitKey;
				var oTableData;
				var oTableSum;
				if (!this.getView().byId(vId)) {
					var oPage = this.getView().byId("page");
					oTableData = new customTable(vId, {
						selectionMode: "None",
						visible: vTableVisibility,
						layoutData: new sap.ui.layout.GridData({
							span: "XL12 L12 M12 S12"
						}),
						visibleRowCount: 0,
						// visibleRowCountMode: "Interactive",
						columnSelect: this.onColumnMenu.bind(this)
							/*,
							firstVisibleRowChanged: this.firstVisibleRowChanged.bind(this)*/
					});

					var vId = "tbl_sum_" + this.aUnits[i].UnitKey;
					oTableSum = new sap.ui.table.Table(vId, {
						selectionMode: "None",
						visible: vTableVisibility,
						layoutData: new sap.ui.layout.GridData({
							span: "XL12 L12 M12 S12"
						}),
						visibleRowCount: 0
					});

					var vId = "pnl" + this.aUnits[i].UnitKey;
					var oToolbar = new sap.m.Toolbar("tlb" + this.aUnits[i].UnitKey, {
						style: "Clear",
						height: "2rem"
					});

					if (this.isFeatureEnabled("EXPANDED")) {
						var oPanel = new sap.m.Panel("pnl" + this.aUnits[i].UnitKey, {
							headerText: "{i18n>planning} " + this.aUnits[i].UnitKey + " - " + this.aUnits[i].UnitText,
							headerToolbar: oToolbar,
							expandable: true,
							expanded: true,
							expand: this.panelExpand.bind(this, oTableSum, oTableData, oToolbar, this.aUnits[i].UnitKey)
						});

						if (this.oCustomizing.PlanLblHideKey === true) {
							var oTitle = new sap.m.Title("ttl" + this.aUnits[i].UnitKey, {
								// text: "{i18n>planning} " + this.aUnits[i].UnitText
								text: this.aUnits[i].UnitText
							});
						} else {
							oTitle = new sap.m.Title("ttl" + this.aUnits[i].UnitKey, {
								text: "{i18n>planning} " + this.aUnits[i].UnitKey + " - " + this.aUnits[i].UnitText
							});
						}

						oToolbar.addContent(oTitle);
						var oToolbarSpacer = new sap.m.ToolbarSpacer("tbs" + this.aUnits[i].UnitKey);
						oToolbar.addContent(oToolbarSpacer);
						var aButtons = [];
						var aFavMenuItems = [];

						var oRptimeLogButton = new sap.m.Button("btn_rptimemsg_" + this.aUnits[i].UnitKey, {
							visible: false,
							type: sap.m.ButtonType.Transparent,
							icon: "sap-icon://message-popup",
							press: this.onOpenRptimeLog.bind(this, aButtons, this.aUnits[i].UnitKey)
						});

						this._oRptime.getItems(this.aUnits[i].UnitKey, oRptimeLogButton).then(function (oResult) {
							if (oResult.aItems[0].Amount > 0 || oResult.aItems[0].Finish === true) {
								if (oResult.aItems[0].Amount > 0) {
									oResult.oTemplate.setType(sap.m.ButtonType.Reject);
									oResult.oTemplate.setText(oResult.aItems[0].Amount);
								} else {
									oResult.oTemplate.setType(sap.m.ButtonType.Accept);
									oResult.oTemplate.setText("");
								}

							} else {
								oResult.oTemplate.setType(sap.m.ButtonType.Unstyled);
								oResult.oTemplate.setText("");
							}
						});

						var oHideButton = new sap.m.ToggleButton("btn_hideB_" + this.aUnits[i].UnitKey, {
							press: this.hideButtons.bind(this, aButtons),
							icon: "sap-icon://overflow",
							tooltip: "{i18n>ttfunctionbutton}",
							visible: true,
							pressed: false
						});
						var oHideSumButton = new sap.m.ToggleButton("btn_hideSB_" + this.aUnits[i].UnitKey, {
							press: this.hideSumData.bind(this, aButtons, this.aUnits[i].UnitKey),
							icon: "sap-icon://chart-table-view",
							tooltip: "{i18n>ttsumbutton}",
							visible: true,
							pressed: true
						});
						var oHidePlanButton = new sap.m.ToggleButton("btn_hidePB_" + this.aUnits[i].UnitKey, {
							press: this.hidePlanData.bind(this, aButtons, this.aUnits[i].UnitKey),
							icon: "sap-icon://personnel-view",
							tooltip: "{i18n>ttplanbutton}",
							visible: true,
							pressed: false
						});
						var oSelectVariant = new sap.m.Select("sel_var_" + this.aUnits[i].UnitKey, {
							visible: true,
							change: this.onChangeVariantForTable.bind(this, this.aUnits[i].UnitKey)
						});

						var oTemplateVariants = new sap.ui.core.Item({
							text: "{VariantName}",
							key: "{Variant}"
						});

					} else {
						var oPanel = new sap.m.Panel("pnl" + this.aUnits[i].UnitKey, {
							headerText: "{i18n>planning} " + this.aUnits[i].UnitKey + " - " + this.aUnits[i].UnitText,
							headerToolbar: oToolbar,
							expandable: true,
							expanded: false,
							expand: this.panelExpand.bind(this, oTableSum, oTableData, oToolbar, this.aUnits[i].UnitKey)
								// expand: this.onPanelExpandWrapper.bind(this, oTableSum, oTableData, oToolbar, this.aUnits[i].UnitKey)
						});
						if (this.oCustomizing.PlanLblHideKey === true) {
							var oTitle = new sap.m.Title("ttl" + this.aUnits[i].UnitKey, {
								// text: "{i18n>planning} " + this.aUnits[i].UnitText
								text: this.aUnits[i].UnitText
							});
						} else {
							oTitle = new sap.m.Title("ttl" + this.aUnits[i].UnitKey, {
								text: "{i18n>planning} " + this.aUnits[i].UnitKey + " - " + this.aUnits[i].UnitText
							});
						}

						oToolbar.addContent(oTitle);
						var oToolbarSpacer = new sap.m.ToolbarSpacer("tbs" + this.aUnits[i].UnitKey);
						oToolbar.addContent(oToolbarSpacer);
						var aButtons = [];
						var aFavMenuItems = [];

						var oRptimeLogButton = new sap.m.Button("btn_rptimemsg_" + this.aUnits[i].UnitKey, {
							visible: false,
							type: sap.m.ButtonType.Transparent,
							icon: "sap-icon://message-popup",
							// press: this.getRptimeLog.bind(this, aButtons, this.aUnits[i].UnitKey)
							press: this.onOpenRptimeLog.bind(this, aButtons, this.aUnits[i].UnitKey)
						});

						this._oRptime.getItems(this.aUnits[i].UnitKey, oRptimeLogButton).then(function (oResult) {
							if (oResult.aItems[0].Amount > 0) {
								oResult.oTemplate.setType(sap.m.ButtonType.Reject);
								oResult.oTemplate.setText(oResult.aItems[0].Amount);
							} else {
								oResult.oTemplate.setType(sap.m.ButtonType.Unstyled);
								oResult.oTemplate.setText("");
							}
						});

						var oHideButton = new sap.m.ToggleButton("btn_hideB_" + this.aUnits[i].UnitKey, {
							press: this.hideButtons.bind(this, aButtons),
							icon: "sap-icon://overflow",
							tooltip: "{i18n>ttfunctionbutton}",
							visible: false,
							pressed: true
						});
						var oHideSumButton = new sap.m.ToggleButton("btn_hideSB_" + this.aUnits[i].UnitKey, {
							press: this.hideSumData.bind(this, aButtons, this.aUnits[i].UnitKey),
							icon: "sap-icon://chart-table-view",
							tooltip: "{i18n>ttsumbutton}",
							visible: false,
							pressed: true
						});
						var oHidePlanButton = new sap.m.ToggleButton("btn_hidePB_" + this.aUnits[i].UnitKey, {
							press: this.hidePlanData.bind(this, aButtons, this.aUnits[i].UnitKey),
							icon: "sap-icon://personnel-view",
							tooltip: "{i18n>ttplanbutton}",
							visible: false,
							pressed: true
						});
						var oSelectVariant = new sap.m.Select("sel_var_" + this.aUnits[i].UnitKey, {
							visible: false,
							change: this.onChangeVariantForTable.bind(this, this.aUnits[i].UnitKey)
						});

						var oTemplateVariants = new sap.ui.core.Item({
							text: "{VariantName}",
							key: "{Variant}"
						});
					}

					oSelectVariant.setModel(oModel);
					oSelectVariant.bindAggregation("items", {
						path: "/colVariantSet",
						template: oTemplateVariants,
						events: {
							dataReceived: function (oEvent) {
								var aItems = [];
								if (oEvent.getParameter("data")) {
									aItems = oEvent.getParameter("data").results;
									var oItem = {};

									for (var l = 0; l < aItems.length; l++) {
										oItem = aItems[l];
										if (oItem.IsActive) {
											oSelectVariant.setSelectedKey(oItem.Variant);
										}
									}
								}

							}.bind(this)
						}
					});

					if (this.isFeatureEnabled("RPTLBUTTON")) {
						oToolbar.addContent(oRptimeLogButton);
					} else {
						oRptimeLogButton.destroy();
					}

					oToolbar.addContent(oHideButton);
					oToolbar.addContent(oHidePlanButton);
					oToolbar.addContent(oHideSumButton);
					oToolbar.addContent(oSelectVariant);
					var oObject = {};
					oObject.UnitKey = this.aUnits[i].UnitKey;
					oObject.Variant = 0;
					oObject.IsActive = true;
					var vVisibility;
					if (this.isFeatureEnabled("EXPANDED")) {
						vVisibility = false;
					} else {
						vVisibility = true;
					}

					var iBtnSize = this.oCustomizing.PlanBtnSize;
					var sSpan = "XL" + iBtnSize + "L" + iBtnSize + "M" + iBtnSize + "S" + iBtnSize;
					var sShortText = "";

					if (this.oCustomizing.PlanBtnShortText) {
						sShortText = "st";
					}
					var bFavoriteActive;
					if (this.isFeatureEnabled("FAVORITE")) {
						bFavoriteActive = true;
					} else {
						bFavoriteActive = false;
					}

					var aMockData = this.aFeatureUsage;

					var oRefreshButton = new sap.m.Button("btn_refresh_" + this.aUnits[i].UnitKey, {
						press: this.onRefreshUnit.bind(this, this.aUnits[i].UnitKey),
						text: "{i18n>" + sShortText + "refresh}",
						tooltip: "{i18n>ttrefresh}",
						icon: "sap-icon://refresh",
						layoutData: new sap.ui.layout.GridData({
							span: sSpan
						}),
						visible: vVisibility
					});
					aButtons.push(oRefreshButton);

					for (var y in aMockData) {
						var item = aMockData[y];

						if (!item.IsFeatureButton || !this["prepare" + item.FeatureKey]) continue;

						if (bFavoriteActive && !this.isFeatureFavorite(item.FeatureKey)) {
							aFavMenuItems.push(new sap.m.MenuItem({
								press: this["prepare" + item.FeatureKey].bind(this, this.aUnits[i].UnitKey),
								text: item.FeatureName,
								icon: "sap-icon://" + item.FeatureIcon
							}));
						} else {
							aButtons.push(new sap.m.Button({
								press: this["prepare" + item.FeatureKey].bind(this, this.aUnits[i].UnitKey),
								tooltip: item.FeatureTooltip,
								text: item.FeatureName,
								icon: "sap-icon://" + item.FeatureIcon,
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							}));
						}
					}

					/*if (this.isFeatureEnabled("ADDEMP")) {
						if (bFavoriteActive && !this.isFeatureFavorite("ADDEMP")) {
							var oAddempMenuItem = new sap.m.MenuItem("mi_addemp_" + this.aUnits[i].UnitKey, {
								press: this.prepareAddEmployee.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "adduser}",
								icon: "sap-icon://employee-lookup"
							});
							aFavMenuItems.push(oAddempMenuItem);
						} else {
							var oAddButton = new sap.m.Button("btn_add_" + this.aUnits[i].UnitKey, {
								press: this.prepareAddEmployee.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "adduser}",
								tooltip: "{i18n>ttadduser}",
								icon: "sap-icon://employee-lookup",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oAddButton);
						}
					}*/
					/*if (this.isFeatureEnabled("TIMEEND")) {
						if (bFavoriteActive && !this.isFeatureFavorite("TIMEEND")) {
							var oAddetimeendItem = new sap.m.MenuItem("mi_timeend_" + this.aUnits[i].UnitKey, {
								press: this.prepareAddEndTime.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "addEndTime}",
								icon: "sap-icon://employee-lookup"
							});
							aFavMenuItems.push(oAddetimeendItem);
						} else {
							var oAddTimeButton = new sap.m.Button("btn_addEndTime_" + this.aUnits[i].UnitKey, {
								press: this.prepareAddEndTime.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "addEndTime}",
								tooltip: "{i18n>ttaddEndTime}",
								icon: "sap-icon://employee-lookup",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oAddTimeButton);
						}
					}*/
					/*if (this.isFeatureEnabled("WERKERVER")) {
						if (bFavoriteActive && !this.isFeatureFavorite("WERKERVER")) {
							var oWerkerverleihung = new sap.m.MenuItem("mi_werkerverleihung_" + this.aUnits[i].UnitKey, {
								press: this.prepareWerkerverleihung.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "Werker}",
								icon: "sap-icon://employee-lookup"
							});
							aFavMenuItems.push(oWerkerverleihung);
						} else {
							var oAddButtonWerker = new sap.m.Button("btn_werkerverleihung_" + this.aUnits[i].UnitKey, {
								press: this.prepareWerkerverleihung.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "Werker}",
								tooltip: "{i18n>ttoWerkerverleihung}",
								icon: "sap-icon://employee-lookup",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oAddButtonWerker);
						}
					}*/
					/*if (this.isFeatureEnabled("LEGEND")) {
						if (bFavoriteActive && !this.isFeatureFavorite("LEGEND")) {
							var oLegendMenuItem = new sap.m.MenuItem("mi_legend_" + this.aUnits[i].UnitKey, {
								press: this.openLegendPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "displaylegend}",
								icon: "sap-icon://legend"
							});
							aFavMenuItems.push(oLegendMenuItem);
						} else {
							var oLegendButton = new sap.m.Button("btn_legend_" + this.aUnits[i].UnitKey, {
								press: this.openLegendPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "displaylegend}",
								icon: "sap-icon://legend",
								tooltip: "{i18n>ttdisplaylegend}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oLegendButton);
						}

					}*/
					// var oController = this;
					/*if (this.isFeatureEnabled("LOG")) {
						if (bFavoriteActive && !this.isFeatureFavorite("LOG")) {
							var oLogMenuItem = new sap.m.MenuItem("mi_log_" + this.aUnits[i].UnitKey, {
								press: this.openLogPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "displaylog}",
								icon: "sap-icon://course-book"
							});
							aFavMenuItems.push(oLogMenuItem);
						} else {
							var oLogButton = new sap.m.Button("btn_log_" + this.aUnits[i].UnitKey, {
								press: this.openLogPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "displaylog}",
								tooltip: "{i18n>ttdisplaylog}",
								icon: "sap-icon://course-book",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oLogButton);
						}
					}*/
					/*if (this.isFeatureEnabled("AUTO")) {
						if (bFavoriteActive && !this.isFeatureFavorite("AUTO")) {
							var oAutoMenuItem = new sap.m.MenuItem("mi_auto_" + this.aUnits[i].UnitKey, {
								press: this.onAutoPlanUnit.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "autoplan}",
								icon: "sap-icon://play"
							});
							aFavMenuItems.push(oAutoMenuItem);
						} else {
							var oAutoButton = new sap.m.Button("btn_auto_" + this.aUnits[i].UnitKey, {
								press: this.onAutoPlanUnit.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "autoplan}",
								icon: "sap-icon://play",
								tooltip: "{i18n>ttautoplan}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oAutoButton);
						}
					}*/
					/*if (this.isFeatureEnabled("POOL")) {
						if (bFavoriteActive && !this.isFeatureFavorite("POOL")) {
							var oPoolMenuItem = new sap.m.MenuItem("mi_pool_" + this.aUnits[i].UnitKey, {
								press: this.onOpenAddPool.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "addpool}",
								icon: "sap-icon://add-employee"
							});
							aFavMenuItems.push(oPoolMenuItem);
						} else {
							var oPoolButton = new sap.m.Button("btn_pool_" + this.aUnits[i].UnitKey, {
								press: this.onOpenAddPool.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "addpool}",
								icon: "sap-icon://add-employee",
								tooltip: "{i18n>ttaddpool}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oPoolButton);
						}
					}*/
					/*if (this.isFeatureEnabled("HIDE")) {
						if (bFavoriteActive && !this.isFeatureFavorite("HIDE")) {
							var oHideMenuItem = new sap.m.MenuItem("mi_hide_" + this.aUnits[i].UnitKey, {
								press: this.onHidePress.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "hide}",
								icon: "sap-icon://table-column"
							});
							aFavMenuItems.push(oHideMenuItem);
						} else {
							var oHideColButton = new sap.m.Button("btn_hide_" + this.aUnits[i].UnitKey, {
								press: this.onHidePress.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "hide}",
								tooltip: "{i18n>tthide}",
								icon: "sap-icon://table-column",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oHideColButton);
						}
					}*/
					/*if (this.isFeatureEnabled("PRINT")) {
						if (bFavoriteActive && !this.isFeatureFavorite("PRINT")) {
							var oPrintMenuItem = new sap.m.MenuItem("mi_print_" + this.aUnits[i].UnitKey, {
								press: this.onPrintForm.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>print}",
								icon: "sap-icon://download"
							});
							aFavMenuItems.push(oPrintMenuItem);
						} else {
							var oPrintButton = new sap.m.Button("btn_print_" + this.aUnits[i].UnitKey, {
								press: this.onPrintForm.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "print}",
								tooltip: "{i18n>ttprint}",
								icon: "sap-icon://download",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oPrintButton);
						}
					}*/
					/*if (this.isFeatureEnabled("LEAVE")) {
						if (bFavoriteActive && !this.isFeatureFavorite("LEAVE")) {
							var oLeaveMenuItem = new sap.m.MenuItem("mi_leave_" + this.aUnits[i].UnitKey, {
								press: this.onLeaveCreate.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "leavecreate}",
								icon: "sap-icon://general-leave-request"
							});
							aFavMenuItems.push(oLeaveMenuItem);
						} else {
							var oLeaveButton = new sap.m.Button("btn_leave_" + this.aUnits[i].UnitKey, {
								press: this.onLeaveCreate.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "leavecreate}",
								icon: "sap-icon://general-leave-request",
								tooltip: "{i18n>ttleavecreate}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oLeaveButton);
						}
					}*/
					/*if (this.isFeatureEnabled("OVERTIME")) {
						if (bFavoriteActive && !this.isFeatureFavorite("OVERTIME")) {
							var oOvertimeMenuItem = new sap.m.MenuItem("mi_overtime_" + this.aUnits[i].UnitKey, {
								press: this.onOvertimeCreate.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + "overtimecreate}",
								icon: "sap-icon://time-overtime"
							});
							aFavMenuItems.push(oOvertimeMenuItem);
						} else {
							var oOvertimeButton = new sap.m.Button("btn_overtime_" + this.aUnits[i].UnitKey, {
								press: this.onOvertimeCreate.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + "overtimecreate}",
								icon: "sap-icon://time-overtime",
								tooltip: "{i18n>ttovertimecreate}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oOvertimeButton);
						}
					}*/
					/*if (this.isFeatureEnabled("CICO")) {
						if (bFavoriteActive && !this.isFeatureFavorite("CICO")) {
							var oCicoMenuItem = new sap.m.MenuItem("mi_cico_" + this.aUnits[i].UnitKey, {
								press: this.onOpenCicoCreate.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "cicocreate}",
								icon: "sap-icon://date-time"
							});
							aFavMenuItems.push(oCicoMenuItem);
						} else {
							var oCicoButton = new sap.m.Button("btn_cico_" + this.aUnits[i].UnitKey, {
								press: this.onOpenCicoCreate.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "cicocreate}",
								icon: "sap-icon://date-time",
								tooltip: "{i18n>ttcicocreate}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oCicoButton);
						}
					}*/
					/*if (this.isFeatureEnabled("TIMSTAT")) {
						if (bFavoriteActive && !this.isFeatureFavorite("TIMSTAT")) {
							var oTimstatMenuItem = new sap.m.MenuItem("mi_timstat_" + this.aUnits[i].UnitKey, {
								press: this.onOpenTimeStatementForm.bind(this, this.aUnits[i].UnitKey),
								icon: "sap-icon://create-form",
								text: "{i18n>" + sShortText + "timestatecreate}"
							});
							aFavMenuItems.push(oTimstatMenuItem);
						} else {
							var oTimeReportButton = new sap.m.Button("btn_timestate_" + this.aUnits[i].UnitKey, {
								press: this.onOpenTimeStatementForm.bind(this, this.aUnits[i].UnitKey),
								icon: "sap-icon://create-form",
								text: "{i18n>" + sShortText + "timestatecreate}",
								tooltip: "{i18n>tttimestatecreate}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oTimeReportButton);
						}
					}*/
					/*if (this.isFeatureEnabled("SAVEKAPA")) {
						if (bFavoriteActive && !this.isFeatureFavorite("SAVEKAPA")) {
							var oSavekapaMenuItem = new sap.m.MenuItem("mi_savekapa_" + this.aUnits[i].UnitKey, {
								press: this.onSaveKapa.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "savekapa}",
								icon: "sap-icon://bus-public-transport"
							});
							aFavMenuItems.push(oSavekapaMenuItem);
						} else {
							var oSaveKapaButton = new sap.m.Button("btn_savekapa_" + this.aUnits[i].UnitKey, {
								press: this.onSaveKapa.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "savekapa}",
								icon: "sap-icon://bus-public-transport",
								tooltip: "{i18n>ttsavekapa}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oSaveKapaButton);
						}
					}*/
					/*if (this.isFeatureEnabled("DEMAND")) {
						if (bFavoriteActive && !this.isFeatureFavorite("DEMAND")) {
							var oDemandMenuItem = new sap.m.MenuItem("mi_demand_" + this.aUnits[i].UnitKey, {
								press: this.onOpenMaintainDemand.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "maintaindemand}",
								icon: "sap-icon://add-equipment"
							});
							aFavMenuItems.push(oDemandMenuItem);
						} else {
							var oDemandButton = new sap.m.Button("btn_demand_" + this.aUnits[i].UnitKey, {
								press: this.onOpenMaintainDemand.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "maintaindemand}",
								icon: "sap-icon://add-equipment",
								tooltip: "{i18n>ttmaintaindemand}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oDemandButton);
						}
					}*/
					/*if (this.isFeatureEnabled("DEMAND2")) {
						if (bFavoriteActive && !this.isFeatureFavorite("DEMAND2")) {
							var oDemandMenuItem2 = new sap.m.MenuItem("mi_demand2_" + this.aUnits[i].UnitKey, {
								press: this.onOpenMaintainDemand2.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "maintaindemand}",
								icon: "sap-icon://add-equipment"
							});
							aFavMenuItems.push(oDemandMenuItem2);
						} else {
							var oDemandButton2 = new sap.m.Button("btn_demand2_" + this.aUnits[i].UnitKey, {
								press: this.onOpenMaintainDemand2.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "maintaindemand}",
								icon: "sap-icon://add-equipment",
								tooltip: "{i18n>ttmaintaindemand}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oDemandButton2);
						}
					}*/
					/*if (this.isFeatureEnabled("RPTIME")) {
						if (bFavoriteActive && !this.isFeatureFavorite("RPTIME")) {
							var oRptimeMenuItem = new sap.m.MenuItem("mi_rptime_" + this.aUnits[i].UnitKey, {
								press: this.onOpenRpTimePopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "rptime}",
								icon: "sap-icon://create-entry-time"
							});
							aFavMenuItems.push(oRptimeMenuItem);
						} else {
							var oRptimeButton = new sap.m.Button("btn_rptime_" + this.aUnits[i].UnitKey, {
								press: this.onOpenRpTimePopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "rptime}",
								icon: "sap-icon://create-entry-time",
								tooltip: "{i18n>rptime}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oRptimeButton);
						}
					}*/
					/*if (this.isFeatureEnabled("SHIFTSUB")) {
						if (bFavoriteActive && !this.isFeatureFavorite("SHIFTSUB")) {
							var oShiftsubMenuItem = new sap.m.MenuItem("mi_shiftsub_" + this.aUnits[i].UnitKey, {
								press: this.onOpenShiftSubstitutionPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "shiftsubstitution}",
								icon: "sap-icon://collaborate"
							});
							aFavMenuItems.push(oShiftsubMenuItem);
						} else {
							var oShiftSubstitutionButton = new sap.m.Button("btn_shiftsub_" + this.aUnits[i].UnitKey, {
								press: this.onOpenShiftSubstitutionPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "shiftsubstitution}",
								icon: "sap-icon://collaborate",
								tooltip: "{i18n>shiftsubstitution}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oShiftSubstitutionButton);
						}
					}*/
					/*if (this.isFeatureEnabled("CYCLEAVE")) {
						if (bFavoriteActive && !this.isFeatureFavorite("CYCLEAVE")) {
							var oCycleaveMenuItem = new sap.m.MenuItem("mi_cycleave_" + this.aUnits[i].UnitKey, {
								press: this.onOpenCyclicLeavePopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "cyclicleave}",
								icon: "sap-icon://future"
							});
							aFavMenuItems.push(oCycleaveMenuItem);
						} else {
							var oCyclicLeaveButton = new sap.m.Button("btn_cycleave_" + this.aUnits[i].UnitKey, {
								press: this.onOpenCyclicLeavePopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "cyclicleave}",
								icon: "sap-icon://future",
								tooltip: "{i18n>cyclicleave}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oCyclicLeaveButton);
						}
					}*/
					/*if (this.isFeatureEnabled("SORTEMP")) {
						if (bFavoriteActive && !this.isFeatureFavorite("SORTEMP")) {
							var oSortempMenuItem = new sap.m.MenuItem("mi_sortemp_" + this.aUnits[i].UnitKey, {
								press: this.onOpenEmployeeSortPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "empsort}",
								icon: "sap-icon://sort"
							});
							aFavMenuItems.push(oSortempMenuItem);
						} else {
							var oEmpSortButton = new sap.m.Button("btn_empSort_" + this.aUnits[i].UnitKey, {
								press: this.onOpenEmployeeSortPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "empsort}",
								icon: "sap-icon://sort",
								tooltip: "{i18n>empsort}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oEmpSortButton);
						}
					}*/
					/*if (this.isFeatureEnabled("DEFQUAL")) {
						if (bFavoriteActive && !this.isFeatureFavorite("DEFQUAL")) {
							var oDefqualMenuItem = new sap.m.MenuItem("mi_defqual_" + this.aUnits[i].UnitKey, {
								press: this.onOpenDefaultQualificationPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "defqual}",
								icon: "sap-icon://activity-individual"
							});
							aFavMenuItems.push(oDefqualMenuItem);
						} else {
							var oDefQualButton = new sap.m.Button("btn_defQual_" + this.aUnits[i].UnitKey, {
								press: this.onOpenDefaultQualificationPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "defqual}",
								icon: "sap-icon://activity-individual",
								tooltip: "{i18n>defqual}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oDefQualButton);
						}
					}*/
					/*if (this.isFeatureEnabled("SHAREPOINT")) {
						if (bFavoriteActive && !this.isFeatureFavorite("SHAREPOINT")) {
							var oSharepointMenuItem = new sap.m.MenuItem("mi_sharepoint_" + this.aUnits[i].UnitKey, {
								press: this.onPressSharepointButton.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "spshare}",
								icon: "sap-icon://share-2"
							});
							aFavMenuItems.push(oSharepointMenuItem);
						} else {
							var oSharepointButton = new sap.m.Button("btn_shareP_" + this.aUnits[i].UnitKey, {
								press: this.onPressSharepointButton.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "spshare}",
								icon: "sap-icon://share-2",
								tooltip: "{i18n>ttspshare}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oSharepointButton);
						}
					}*/
					/*if (this.isFeatureEnabled("NEWSLET")) {
						if (bFavoriteActive && !this.isFeatureFavorite("NEWSLET")) {
							var oNewsletMenuItem = new sap.m.MenuItem("mi_newslet_" + this.aUnits[i].UnitKey, {
								press: this.onOpenNewsletterPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "newsletter}",
								icon: "sap-icon://newspaper"
							});
							aFavMenuItems.push(oNewsletMenuItem);
						} else {
							var oNewsLetterButton = new sap.m.Button("btn_newsletter_" + this.aUnits[i].UnitKey, {
								press: this.onOpenNewsletterPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "newsletter}",
								icon: "sap-icon://newspaper",
								tooltip: "{i18n>newsletter}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oNewsLetterButton);
						}
					}*/
					/*if (this.isFeatureEnabled("MAINTQUAL")) {
						if (bFavoriteActive && !this.isFeatureFavorite("MAINTQUAL")) {
							var oMaintqualMenuItem = new sap.m.MenuItem("mi_maintqual_" + this.aUnits[i].UnitKey, {
								press: this.onOpenMaintQualPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "changequal}",
								icon: "sap-icon://study-leave"
							});
							aFavMenuItems.push(oMaintqualMenuItem);
						} else {
							var oMaintQualButton = new sap.m.Button("btn_maintqual_" + this.aUnits[i].UnitKey, {
								press: this.onOpenMaintQualPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "changequal}",
								icon: "sap-icon://study-leave",
								tooltip: "{i18n>changequal}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oMaintQualButton);
						}
					}*/
					/*if (this.isFeatureEnabled("SELDROP")) {
						if (bFavoriteActive && !this.isFeatureFavorite("SELDROP")) {
							var oSeldropMenuItem = new sap.m.MenuItem("mi_seldrop_" + this.aUnits[i].UnitKey, {
								press: this.onOpenSelectDropdown.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "selectdropdown}",
								icon: "sap-icon://multi-select"
							});
							aFavMenuItems.push(oSeldropMenuItem);
						} else {
							var oSelectDropdownButton = new sap.m.Button("btn_selectdropdown_" + this.aUnits[i].UnitKey, {
								press: this.onOpenSelectDropdown.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "selectdropdown}",
								icon: "sap-icon://multi-select",
								tooltip: "{i18n>selectdropdown}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oSelectDropdownButton);
						}
					}*/
					/*if (this.isFeatureEnabled("XLSDOWN")) {
						if (bFavoriteActive && !this.isFeatureFavorite("XLSDOWN")) {
							var oXlsdownMenuItem = new sap.m.MenuItem("mi_xlsdown_" + this.aUnits[i].UnitKey, {
								press: this.onOpenPlanExcelPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "xlsdownbutton}",
								icon: "sap-icon://excel-attachment"
							});
							aFavMenuItems.push(oXlsdownMenuItem);
						} else {
							var oXlsDownloadButton = new sap.m.Button("btn_xlsdownload_" + this.aUnits[i].UnitKey, {
								press: this.onOpenPlanExcelPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "xlsdownbutton}",
								icon: "sap-icon://excel-attachment",
								tooltip: "{i18n>ttxlsdownbutton}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oXlsDownloadButton);
						}
					}*/
					/*if (this.isFeatureEnabled("EMP_EXCEL")) {
						if (bFavoriteActive && !this.isFeatureFavorite("EMP_EXCEL")) {
							var oEmpExcelMenuItem = new sap.m.MenuItem("mi_emp_excel_" + this.aUnits[i].UnitKey, {
								press: this.onOpenPlanEmpExcelPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "empexcelbutton}",
								icon: "sap-icon://excel-attachment"
							});
							aFavMenuItems.push(oEmpExcelMenuItem);
						} else {
							var oEmpExcelloadButton = new sap.m.Button("btn_emp_excel_" + this.aUnits[i].UnitKey, {
								press: this.onOpenPlanEmpExcelPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "empexcelbutton}",
								icon: "sap-icon://excel-attachment",
								tooltip: "{i18n>ttempexcelbutton}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oEmpExcelloadButton);
						}
					}*/
					/*if (this.isFeatureEnabled("ROSTER")) {
						if (bFavoriteActive && !this.isFeatureFavorite("ROSTER")) {
							var oRosterMenuItem = new sap.m.MenuItem("mi_roster_" + this.aUnits[i].UnitKey, {
								press: this.onOpenRosterPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "rosterbutton}",
								icon: "sap-icon://pdf-attachment"
							});
							aFavMenuItems.push(oRosterMenuItem);
						} else {
							var oRosterloadButton = new sap.m.Button("btn_roster_" + this.aUnits[i].UnitKey, {
								press: this.onOpenRosterPopup.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "rosterbutton}",
								icon: "sap-icon://pdf-attachment",
								tooltip: "{i18n>ttrosterbutton}",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oRosterloadButton);
						}
					}*/
					/*if (this.isFeatureEnabled("VALIDATION")) {
						if (bFavoriteActive && !this.isFeatureFavorite("VALIDATION")) {
							var oValidationMenuItem = new sap.m.MenuItem("mi_validation_" + this.aUnits[i].UnitKey, {
								press: this.validateAll.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>validation}",
								icon: "sap-icon://validate",
								tooltip: "{i18n>ttvalidation}"
							});
							aFavMenuItems.push(oValidationMenuItem);
						} else {
							var oValidationButton = new sap.m.Button("btn_validation_" + this.aUnits[i].UnitKey, {
								press: this.validateAll.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "validation}",
								tooltip: "{i18n>ttvalidation}",
								icon: "sap-icon://validate",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(oValidationButton);
						}
					}*/
					/*if (this.isFeatureEnabled("17WEEKS")) {
						if (bFavoriteActive && !this.isFeatureFavorite("17WEEKS")) {
							var o17WeeksMenuItem = new sap.m.MenuItem("mi_17weeks_" + this.aUnits[i].UnitKey, {
								press: this.validateAll.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>17weeks}",
								icon: "sap-icon://validate",
								tooltip: "{i18n>tt17weeks}"
							});
							aFavMenuItems.push(o17WeeksMenuItem);
						} else {
							var o17WeeksButton = new sap.m.Button("btn_17weeks_" + this.aUnits[i].UnitKey, {
								press: this.validateAll.bind(this, this.aUnits[i].UnitKey),
								text: "{i18n>" + sShortText + "17weeks}",
								tooltip: "{i18n>tt17weeks}",
								icon: "sap-icon://validate",
								layoutData: new sap.ui.layout.GridData({
									span: sSpan
								}),
								visible: vVisibility
							});
							aButtons.push(o17WeeksButton);
						}
					}*/

					//FavoritenButton muss immer der letzte bleiben!!
					if (this.isFeatureEnabled("FAVORITE")) {
						var oFavMenu = new sap.m.Menu("menu_favorites_" + this.aUnits[i].UnitKey, {
							items: aFavMenuItems
						});
						var oFavFeatButton = new sap.m.MenuButton("btn_favfeat_" + this.aUnits[i].UnitKey, {
							defaultAction: function () {
								this.onOpenFavoriteFeaturesDialog(this);
							}.bind(this),
							icon: "sap-icon://add-favorite",
							text: "{i18n>favorites}",
							buttonMode: "Split",
							useDefaultActionOnly: true,
							menu: oFavMenu,
							layoutData: new sap.ui.layout.GridData({
								span: sSpan
							}),
							visible: vVisibility
						});
						aButtons.push(oFavFeatButton);
					}
					if (this.isFeatureEnabled("HIDEEMPS")) {
						var oVBox = new sap.m.VBox("vbox_hideEmp_" + this.aUnits[i].UnitKey, {
							fitContainer: true,
							layoutData: new sap.ui.layout.GridData({
								span: "XL12 L12 M12 S12"
							})
						});
						var oHideEmpTable = new sap.ui.table.Table("tbl_hideEmp_" + this.aUnits[i].UnitKey, {
							visible: false,
							selectionMode: "None",
							width: "350px"
						});
						oVBox.addItem(oHideEmpTable);
						var oHideEmpBtn = new sap.m.ToggleButton("btn_hideEmp_" + this.aUnits[i].UnitKey, {
							press: this.onHideEmpBtnPress.bind(this, aButtons, this.aUnits[i].UnitKey),
							icon: "sap-icon://add-employee",
							tooltip: "{i18n>tthideemp}",
							visible: false,
							pressed: false
						});
						oToolbar.addContent(oHideEmpBtn);
					}
					if (oVBox) {
						aButtons.push(oVBox);
					}
					aButtons.push(oTableData);
					aButtons.push(oTableSum);
					var oButtonForm = new sap.ui.layout.form.SimpleForm({
						content: aButtons,
						columnsXL: 12,
						columnsL: 12,
						columnsM: 12,
						layout: "ResponsiveGridLayout"
					});
					oPanel.addContent(oButtonForm);
					aPanels.push(oPanel);

					this._tables.unit[this.aUnits[i].UnitKey] = oTableData;
					this._tables.sum[this.aUnits[i].UnitKey] = oTableSum;
				} else {
					oTableData = this.getView().byId("tbl_plan_" + this.aUnits[i].UnitKey);
					oTableSum = this.getView().byId("tbl_sum" + this.aUnits[i].UnitKey);

					this._tables.unit[this.aUnits[i].UnitKey] = oTableData;
					this._tables.sum[this.aUnits[i].UnitKey] = oTableSum;
				}
				oTableData.setBusyIndicatorDelay(0);
				oTableSum.setBusyIndicatorDelay(0);
				oTableSum.setBusy(true);
				oTableData.setBusy(true);

				if (vTableVisibility === false) {
					var sCurUnitKey = this.aUnits[i].UnitKey;
					$.when(this._oRptime.getData(this, sCurUnitKey)).then(function (sUnitKey) {

						this.fillSumTable(this._tables.sum[sUnitKey], sUnitKey);
						this.fillUnitTable(this._tables.unit[sUnitKey], sUnitKey);

					}.bind(this));
				}
			}

			for (var j = 0; j < aPanels.length; j++) {
				oPage.addContent(aPanels[j]);
				oDeferred.resolve();
			}

			return oDeferred;
		},

		firstVisibleRowChanged: function (oEvent) {
			// var aCtxs = oEvent.getSource().getBinding().getContexts();
			// var iRowCount = oEvent.getSource().getVisibleRowCount();
			// var iFirstVisibleRow = oEvent.getSource().getFirstVisibleRow();
			// var iCounter = iRowCount + iFirstVisibleRow;

			// for (var i = iFirstVisibleRow; i < iCounter; i++) {

			// }
			var oCell;
			var aCells;

			var aRows = oEvent.getSource().getRows();
			for (var i = 0; i < aRows.length; i++) {
				aCells = aRows[i].getCells();
				for (var j = 0; j < aCells.length; j++) {
					oCell = aCells[j];
					oCell.rerender();
				}
			}
			// oEvent.getSource().rerender();
		},

		onOpenFavoriteFeaturesDialog: function () {
			if (!this._oFavoriteFeaturesDialog) {
				this._oFavoriteFeaturesDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.FavoriteFeatures", this, {
					refreshAfterChange: true
				});
				this.getView().addDependent(this._oFavoriteFeaturesDialog);
				this._oFavoriteFeaturesDialog.open();
				this._oFavoriteFeaturesDialog.attachAfterClose(function () {
					this._oFavoriteFeaturesDialog.getModel().detachBatchRequestCompleted("onFavoriteBatchRequestCompleted");
					this._oFavoriteFeaturesDialog
						.destroy();
					this._oFavoriteFeaturesDialog = null;
				}.bind(this));
				this._oFavoriteFeaturesDialog.attachAfterOpen(function () {
					this._oFavoriteFeaturesDialog.setBusy(false);
				}.bind(this));
				this._oFavoriteFeaturesDialog.setBusyIndicatorDelay(0);
				this._oFavoriteFeaturesDialog.setBusy(true);
			}
		},

		onSaveFavorites: function (oEvent) {
			this._oFavoriteFeaturesDialog.setBusy(true);
			var oModel = oEvent.getSource().getModel();
			oModel.attachBatchRequestCompleted(this.onFavoriteBatchRequestCompleted());
			oModel.submitChanges();
		},

		onFavoriteBatchRequestCompleted: function () {
			this._oFavoriteFeaturesDialog.setBusy(false);
			MessageToast.show(this.getResourceBundleText("favsaved"));
			this._oFavoriteFeaturesDialog.close();
		},

		onChangeFavorite: function (oEvent) {
			var oCtx = oEvent.getSource().getBindingContext();
			var oModel = oEvent.getSource().getModel();
			// var bCurrState = oCtx.getProperty("IsFavorite");
			// if (bCurrState) {
			// oModel.setProperty("IsFavorite", false, oCtx);
			// } else {
			oModel.setProperty("IsFavorite", oEvent.getParameter("selected"), oCtx);
			// }
		},

		prepareVALIDATION: function (vUnitKey) {
			var oPanel = sap.ui.getCore().byId("pnl" + vUnitKey);
			// oPanel.setBusy(true);
			var oBegda = this.getSelectedBegda();
			var oEndda = this.getSelectedEndda();
			var oSumTable = sap.ui.getCore().byId("tbl_sum_" + vUnitKey);
			var oModel = this.getView().getModel();
			oSumTable.setBusy(true);
			// this.removeColumns(oSumTable, "Scol");
			oModel.callFunction("/RunAllValidations", {
				method: "GET",
				urlParameters: {
					"UnitKey": vUnitKey,
					"Begda": oBegda,
					"Endda": oEndda,
					"AllValidations": true
				},
				success: function (oData) {
					if (oSumTable.getVisible()) {
						if (oSumTable.getVisible()) {
							oSumTable.destroyColumns();
							this.fillSumTable(oSumTable, vUnitKey);
						}
					}
				}.bind(this),
				error: function () {
					oSumTable.setBusy(false);
					// oPanel.setBusy(false);
				}.bind(this)
			});
		},
		prepare17WEEKS: function (vUnitKey) {
			this.prepareVALIDATION(vUnitKey);
		},

		preparePRINT: function (vUnitKey) {
			if (!this._oPrintFormDialog) {
				this._oPrintFormDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.FormDownload", this);
				this._oPrintFormDialog.attachAfterClose(this.destroyFormDownload.bind(this));
				this._oPrintFormDialog.setModel(new sap.ui.model.json.JSONModel(), "FormDownloadModel");
				this._oPrintFormDialog.getModel('FormDownloadModel').setProperty("/RadioIndex", 0);
				this.getView().addDependent(this._oPrintFormDialog);
				var oDate = this.getMonday(this.getSelectedBegda());
				var oDP = sap.ui.getCore().byId("dp_form_begda");
				oDP.setDateValue(oDate);
				var oButton = sap.ui.getCore().byId("btn_form_download");
				oButton.attachPress(this.downloadPDF.bind(this, vUnitKey));
			}
			this._oPrintFormDialog.open();
		},

		getMonday: function (oDate) {
			oDate = new Date(oDate);
			var iDay = oDate.getDay(),
				iDiff = oDate.getDate() - iDay + (iDay == 0 ? -6 : 1);
			return new Date(oDate.setDate(iDiff));
		},

		destroyFormDownload: function () {
			this._oPrintFormDialog.destroy();
			this._oPrintFormDialog = null;
		},

		closeFormDownload: function () {
			this._oPrintFormDialog.close();
		},

		prepareLEAVE: function (vUnitKey) {
			var oEvent;
			this.openTimeOverviewPopupWrapper(oEvent, vUnitKey);
		},

		onUpdateLeave: function () {
			var oTable = sap.ui.getCore().byId("ld_tbl_leaveoverview");
			var oBegda = sap.ui.getCore().byId("ld_dp_begda_leave").getDateValue();
			var oEndda = sap.ui.getCore().byId("ld_dp_endda_leave").getDateValue();
			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_leave");
			var oCbPrevDay = sap.ui.getCore().byId("chb_absence_day");
			var sInfty = oSubtySelect.getSelectedItem().getCustomData()[1].getProperty("value");
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var bSprps;
			var otimeFormatter = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "PTHH'H'mm'M'ss'S'"
			});
			if (!oSubtySelect.getSelectedKey == "") {
				if (sap.ui.getCore().byId("chb_sprps")) {
					bSprps = sap.ui.getCore().byId("chb_sprps").getSelected();
				}
				var oBeguzPicker = sap.ui.getCore().byId("ld_tp_beguz_leave");
				if (oBeguzPicker.getVisible()) {
					var oBeguz = oBeguzPicker.getDateValue();
				}
				var oEnduzPicker = sap.ui.getCore().byId("ld_tp_enduz_leave");
				if (oEnduzPicker.getVisible()) {
					var oEnduz = oEnduzPicker.getDateValue();
				}

				var oAbsenceReasonSelect = sap.ui.getCore().byId("ld_select_subty_reason");
				var oCommentAbsenceReason = sap.ui.getCore().byId("ld_inp_subty_reason");

				if (oAbsenceReasonSelect.getVisible() == true && oCommentAbsenceReason.getVisible() == true) {
					var vAbsenceReason = oAbsenceReasonSelect.getSelectedKey();
					var vCommentAbsenceReason = oCommentAbsenceReason.getValue();
				}

				var oContext = oTable.getContextByIndex(oTable.getSelectedIndex());

				oBegda.setHours(12);
				oEndda.setHours(12);

				var vPrevDay = oCbPrevDay.getSelected();

				var oRecord = {};
				oRecord.CommentKey = vAbsenceReason;
				oRecord.Comment = vCommentAbsenceReason;
				oRecord.EmpId = oEmpSelect.getSelectedItem().getKey();
				oRecord.Subty = oSubtySelect.getSelectedItem().getKey();
				oRecord.Infty = sInfty;
				oRecord.Subty = oSubtySelect.getSelectedKey();
				oRecord.UnitKey = oContext.getProperty("UnitKey");
				oRecord.Begda = oBegda;
				oRecord.Endda = oEndda;
				oRecord.PrevDay = vPrevDay;

				//change 01.02.2021 Anna Grigoran: only set Beguz and Enduz if datePicker is visible
				if (oBeguzPicker.getVisible()) {
					oRecord.Beguz = otimeFormatter.format(new Date(oBeguz));
				}
				if (oEnduzPicker.getVisible()) {
					oRecord.Enduz = otimeFormatter.format(new Date(oEnduz));
				}

				oRecord.Sprps = bSprps;
				oRecord.Seqnr = oContext.getProperty("Seqnr");

				this.getView().getModel().update(oContext.sPath, oRecord, {
					success: function () {
						this.updateLeaveSuccess();
						oTable.setBusy(false);
					}.bind(this),
					error: function (oError) {
						this.createError(oError);
						oTable.setBusy(false);
					}.bind(this)
				});

			}

		},

		onEmployeeChangeTimeOverview: function () {
			this.onEmployeeSelect();
			this.getEmpShift();
			this.onCicoEmployeeChange();
			this.onEmployeeOvertimeSelect();
			this.getAllowanceSet();
			this.getTimeTransfer();
			this.bindRptimeMsgTimesOverview();
		},

		onEmployeeSelect: function () {
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/MIND2/PEP_YEAR_SRV");
			var oSelectedItem = oEmpSelect.getSelectedItem();
			var vEmpId = oSelectedItem.getKey();
			var aCustomData = oSelectedItem.getCustomData();
			var vUnitKey = Helper.getCustomDataValue(aCustomData, "UnitKey");
			var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

			var vMessageType = "ABSENCE";
			var vSumKey = "";
			var oDate = sap.ui.getCore().byId("ld_dp_currentDate").getDateValue();
			var oMsgTypeFilter = new sap.ui.model.Filter("MsgType", sap.ui.model.FilterOperator.EQ, vMessageType);
			var oDateFilter = new sap.ui.model.Filter("PlanDate", sap.ui.model.FilterOperator.EQ, oDate);
			var oSumFilter = new sap.ui.model.Filter("SumKey", sap.ui.model.FilterOperator.EQ, vSumKey);

			var oAbsenceReasonSelect = sap.ui.getCore().byId("ld_select_subty_reason");
			var oCommentAbsenceReason = sap.ui.getCore().byId("ld_inp_subty_reason");

			oAbsenceReasonSelect.setValueState(sap.ui.core.ValueState.None);
			oAbsenceReasonSelect.setSelectedKey();
			oCommentAbsenceReason.setValue();
			oCommentAbsenceReason.setValueState(sap.ui.core.ValueState.None);
			oCommentAbsenceReason.setVisible(false);

			this.fillLeaveTable();

			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_leave");

			oModel.read("/SubtypSet", {
				success: function (oData) {
					oSubtySelect.removeAllItems();
					var aData = oData.results;
					var oItem = new sap.ui.core.Item({
						text: "",
						key: ""
					});

					for (var i = 0; i < aData.length; i++) {
						var oTemplate = new sap.ui.core.Item({
							text: aData[i].Subty + " - " + aData[i].SubtyText,
							key: aData[i].Subty,
							customData: [{
								Type: "sap.ui.core.CustomData",
								key: "ganztaegig",
								value: aData[i].Ganztaegig // bind custom data
							}, {
								Type: "sap.ui.core.CustomData",
								key: "Infty",
								value: aData[i].Infty // bind custom data
							}, {
								Type: "sap.ui.core.CustomData",
								key: "ReasonMand",
								value: aData[i].ReasonMand // bind custom data
							}]
						});
						if (i === 0) {
							oSubtySelect.addItem(oItem);
							oSubtySelect.addItem(oTemplate);
							oSubtySelect.setSelectedItem(oItem);
						} else {
							oSubtySelect.addItem(oTemplate);
						}
					}
				}.bind(this),
				filters: [oEmpIdFilter, oUnitFilter]
			});

			oModel = this.getView().getModel();

			oAbsenceReasonSelect.setModel(oModel);

			var oTemplate = new sap.ui.core.Item({
				text: "{NoteText}",
				key: "{NoteKey}"
			});

			oAbsenceReasonSelect.bindAggregation("items", {
				path: "/messageNoteSet",
				template: oTemplate,
				filters: [oMsgTypeFilter, oDateFilter, oUnitFilter, oSumFilter],
				events: {
					dataReceived: function () {

					}.bind(this)
				}
			});
		},

		onSaveLeave: function () {
			var oTable = sap.ui.getCore().byId("ld_tbl_leaveoverview");
			var oBegda = sap.ui.getCore().byId("ld_dp_begda_leave").getDateValue();
			var oEndda = sap.ui.getCore().byId("ld_dp_endda_leave").getDateValue();
			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_leave");
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oAbsenceReasonSelect = sap.ui.getCore().byId("ld_select_subty_reason");
			var oCommentAbsenceReason = sap.ui.getCore().byId("ld_inp_subty_reason");
			var oCbDay = sap.ui.getCore().byId("chb_absence_day");
			var vUnitKey;
			oSubtySelect.setValueState(sap.ui.core.ValueState.None);
			oAbsenceReasonSelect.setValueState(sap.ui.core.ValueState.None);
			oCommentAbsenceReason.setValueState(sap.ui.core.ValueState.None);

			if (this._oLeaveDialog) {
				vUnitKey = Helper.getCustomDataValue(this._oLeaveDialog.getAggregation("customData"), "UnitKey");
			} else {
				vUnitKey = Helper.getCustomDataValue(this._oTimesOverviewDialog.getAggregation("customData"), "UnitKey");
			}

			if (!oSubtySelect.getSelectedKey() ||
				(oAbsenceReasonSelect.getVisible() && oSubtySelect.getSelectedItem().getAggregation("customData")[2].getProperty("value") && !
					oAbsenceReasonSelect.getSelectedKey()) ||
				(oCommentAbsenceReason.getRequired() && oCommentAbsenceReason.getValue() == "")) {

				if (!oSubtySelect.getSelectedKey()) {
					oSubtySelect.setValueState(sap.ui.core.ValueState.Error);
				}
				if (oAbsenceReasonSelect.getVisible()) {
					if (!oAbsenceReasonSelect.getSelectedKey()) {
						oAbsenceReasonSelect.setValueState(sap.ui.core.ValueState.Error);
					}
					if (oCommentAbsenceReason.getRequired()) {
						if (oCommentAbsenceReason.getValue() == "") {
							oCommentAbsenceReason.setValueState(sap.ui.core.ValueState.Error);
						}
					}
				}

			} else {

				oTable.setBusy(true);
				var vInfty = oSubtySelect.getSelectedItem().getCustomData()[1].getProperty("value");
				var bSprps;
				if (sap.ui.getCore().byId("chb_sprps")) {
					bSprps = sap.ui.getCore().byId("chb_sprps").getSelected();
				}
				if (bSprps == true) {
					bSprps = true;
				} else {
					bSprps = false;
				}
				var oBeguzPicker = sap.ui.getCore().byId("ld_tp_beguz_leave");
				if (oBeguzPicker.getVisible() == true) {
					var vBeguz = oBeguzPicker.getDateValue();
				}
				var oEnduzPicker = sap.ui.getCore().byId("ld_tp_enduz_leave");
				if (oEnduzPicker.getVisible() == true) {
					var vEnduz = oEnduzPicker.getDateValue();
				}

				if (oAbsenceReasonSelect.getVisible() == true && oCommentAbsenceReason.getVisible() == true) {
					var vAbsenceReason = oAbsenceReasonSelect.getSelectedKey();
					var vCommentAbsenceReason = oCommentAbsenceReason.getValue();
				}
				if (oBegda && oEndda) {
					var vSubty = oSubtySelect.getSelectedItem().getKey();
					var vEmpId = oEmpSelect.getSelectedItem().getKey();
					var oRecord = {};
					var otimeFormatter = sap.ui.core.format.DateFormat.getDateInstance({
						pattern: "PTHH'H'mm'M'ss'S'"
					});

					var vPrevDay = oCbDay.getSelected();

					oRecord.CommentKey = vAbsenceReason;
					oRecord.Comment = vCommentAbsenceReason;
					oRecord.Infty = vInfty;
					oRecord.Subty = vSubty;
					oRecord.EmpId = vEmpId;
					oRecord.Sprps = bSprps;
					oRecord.Begda = new Date(oBegda.setHours(12));
					oRecord.Endda = new Date(oEndda.setHours(12));
					oRecord.PrevDay = vPrevDay;
					if (oBeguzPicker.getDateValue()) {
						oRecord.Beguz = otimeFormatter.format(new Date(oBeguzPicker.getDateValue()));
					}
					if (oEnduzPicker.getDateValue()) {
						oRecord.Enduz = otimeFormatter.format(new Date(oEnduzPicker.getDateValue()));
					}
					oRecord.UnitKey = vUnitKey;
					this.getView().getModel().create("/absenceSet", oRecord, {
						success: function (oData, oResponse) {
							oTable.setBusy(false);
							this.createSuccess(oData, oResponse);
						}.bind(this),
						error: function (oError) { //yannick
							oTable.setBusy(false);
							var aErrorMsg = JSON.parse(oError.responseText).error.innererror.errordetails;
							var aMessageType = aErrorMsg[0].severity;
							if (aMessageType === "warning") {
								Helper.openConfirmDialog("{i18n>areyousure}", aErrorMsg[0].message, "{i18n>yes}", this.overwriteLeave.bind(this),
									null,
									this);
							} else {
								this.createError(oError);
							}
						}.bind(this)
					});
				} else {
					oTable.setBusy(false);
					if (!oBegda) {
						sap.ui.getCore().byId("ld_dp_begda_leave").setValueState(sap.ui.core.ValueState.Error);
					} else {
						sap.ui.getCore().byId("ld_dp_begda_leave").setValueState(sap.ui.core.ValueState.None);
					}
					if (!oEndda) {
						sap.ui.getCore().byId("ld_dp_endda_leave").setValueState(sap.ui.core.ValueState.Error);
					} else {
						sap.ui.getCore().byId("ld_dp_endda_leave").setValueState(sap.ui.core.ValueState.None);
					}
					if (!vBeguz) {
						sap.ui.getCore().byId("ld_tp_beguz_leave").setValueState(sap.ui.core.ValueState.Error);
					} else {
						sap.ui.getCore().byId("ld_tp_beguz_leave").setValueState(sap.ui.core.ValueState.None);
					}
					if (!vEnduz) {
						sap.ui.getCore().byId("ld_tp_enduz_leave").setValueState(sap.ui.core.ValueState.Error);
					} else {
						sap.ui.getCore().byId("ld_tp_enduz_leave").setValueState(sap.ui.core.ValueState.None);
					}
				}
			}
		},

		overwriteLeave: function () {
			var oTable = sap.ui.getCore().byId("ld_tbl_leaveoverview");
			var oBegda = sap.ui.getCore().byId("ld_dp_begda_leave").getDateValue();
			var oEndda = sap.ui.getCore().byId("ld_dp_endda_leave").getDateValue();
			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_leave");
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oCbDay = sap.ui.getCore().byId("chb_absence_day");
			var vUnitKey;
			oSubtySelect.setValueState(sap.ui.core.ValueState.None);

			var vPrevDay = oCbDay.getSelected();

			if (this._oLeaveDialog) {
				vUnitKey = Helper.getCustomDataValue(this._oLeaveDialog.getAggregation("customData"), "UnitKey");
			} else {
				vUnitKey = Helper.getCustomDataValue(this._oTimesOverviewDialog.getAggregation("customData"), "UnitKey");
			}

			if (!oSubtySelect.getSelectedKey()) {

				oSubtySelect.setValueState(sap.ui.core.ValueState.Error);

			} else {
				oTable.setBusy(true);
				var vInfty = oSubtySelect.getSelectedItem().getCustomData()[1].getProperty("value");
				var bSprps;
				if (sap.ui.getCore().byId("chb_sprps")) {
					bSprps = sap.ui.getCore().byId("chb_sprps").getSelected();
				}
				if (bSprps == true) {
					bSprps = true;
				} else {
					bSprps = false;
				}
				var oBeguzPicker = sap.ui.getCore().byId("ld_tp_beguz_leave");
				if (oBeguzPicker.getVisible() == true) {
					var vBeguz = oBeguzPicker.getDateValue();
				}
				var oEnduzPicker = sap.ui.getCore().byId("ld_tp_enduz_leave");
				if (oEnduzPicker.getVisible() == true) {
					var vEnduz = oEnduzPicker.getDateValue();
				}
				var oAbsenceReasonSelect = sap.ui.getCore().byId("ld_select_subty_reason");
				var oCommentAbsenceReason = sap.ui.getCore().byId("ld_inp_subty_reason");

				if (oAbsenceReasonSelect.getVisible() == true && oCommentAbsenceReason.getVisible() == true) {
					var vAbsenceReason = oAbsenceReasonSelect.getSelectedKey();
					var vCommentAbsenceReason = oCommentAbsenceReason.getValue();
				}
				if (oBegda && oEndda) {
					var vSubty = oSubtySelect.getSelectedItem().getKey();
					var vEmpId = oEmpSelect.getSelectedItem().getKey();
					var oRecord = {};
					var otimeFormatter = sap.ui.core.format.DateFormat.getDateInstance({
						pattern: "PTHH'H'mm'M'ss'S'"
					});
					oRecord.CommentKey = vAbsenceReason;
					oRecord.Comment = vCommentAbsenceReason;
					oRecord.Infty = vInfty;
					oRecord.Subty = vSubty;
					oRecord.EmpId = vEmpId;
					oRecord.Sprps = bSprps;
					oRecord.Begda = oBegda;
					oRecord.Endda = oEndda;
					oRecord.PrevDay = vPrevDay;
					if (oBeguzPicker.getDateValue()) {
						oRecord.Beguz = otimeFormatter.format(new Date(oBeguzPicker.getDateValue()));
					}
					if (oEnduzPicker.getDateValue()) {
						oRecord.Enduz = otimeFormatter.format(new Date(oEnduzPicker.getDateValue()));
					}
					oRecord.Overwrite = true;
					oRecord.UnitKey = vUnitKey;
					this.getView().getModel().create("/absenceSet", oRecord, {
						success: function (oData, oResponse) {
							oTable.setBusy(false);
							this.createSuccess(oData, oResponse);
						}.bind(this),
						error: function (oError) { //yannick
							oTable.setBusy(false);
							var aErrorMsg = JSON.parse(oError.responseText).error.innererror.errordetails;
							var aMessageType = aErrorMsg[0].severity;
							if (aMessageType === "warning") {
								Helper.openConfirmDialog("{i18n>areyousure}", aErrorMsg[0].message, "{i18n>yes}", this.overwriteLeave.bind(this),
									null,
									this);
							} else {
								this.createError(oError);
							}
						}.bind(this)
					});
				}
			}
			// var oTable = sap.ui.getCore().byId("ld_tbl_leaveoverview");
			// var vBegda = sap.ui.getCore().byId("ld_dp_begda_leave").getDateValue();
			// var vEndda = sap.ui.getCore().byId("ld_dp_endda_leave").getDateValue();
			// var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_leave");

			// var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			// var vUnitKey;

			// oSubtySelect.setValueState(sap.ui.core.ValueState.None);

			// if (!oSubtySelect.getSelectedKey()) {

			// 	oSubtySelect.setValueState(sap.ui.core.ValueState.Error);

			// } else {
			// 	var vInfty = oSubtySelect.getSelectedItem().getCustomData()[1].getProperty("value");
			// 	if (this._oLeaveDialog) {
			// 		vUnitKey = Helper.getCustomDataValue(this._oLeaveDialog.getAggregation("customData"), "UnitKey");
			// 	} else {
			// 		vUnitKey = Helper.getCustomDataValue(this._oTimesOverviewDialog.getAggregation("customData"), "UnitKey");
			// 	}

			// 	var vSprps;
			// 	if (sap.ui.getCore().byId("chb_sprps")) {
			// 		vSprps = sap.ui.getCore().byId("chb_sprps").getSelected();
			// 	}
			// 	if (vSprps == true) {
			// 		vSprps = "X";
			// 	} else {
			// 		vSprps = "";
			// 	}
			// 	var oBeguz = sap.ui.getCore().byId("ld_tp_beguz_leave");
			// 	if (oBeguz.getVisible() == true) {
			// 		var vBeguz = oBeguz.getValue();
			// 	}
			// 	var oEnduz = sap.ui.getCore().byId("ld_tp_enduz_leave");
			// 	if (oEnduz.getVisible() == true) {
			// 		var vEnduz = oEnduz.getValue();
			// 	}
			// 	if (vBegda && vEndda) {
			// 		oTable.setBusy(false);

			// 		var vSubty = oSubtySelect.getSelectedItem().getKey();
			// 		var vEmpId = oEmpSelect.getSelectedItem().getKey();
			// 		var vBegdaYear = vBegda.getYear() + 1900;
			// 		var vEnddaYear = vEndda.getYear() + 1900;
			// 		var vBegdaMonth = vBegda.getMonth() + 1;
			// 		if (vBegdaMonth.toString().length == 1) {
			// 			vBegdaMonth = "0" + vBegdaMonth;
			// 		}
			// 		var vEnddaMonth = vEndda.getMonth() + 1;
			// 		if (vEnddaMonth.toString().length == 1) {
			// 			vEnddaMonth = "0" + vEnddaMonth;
			// 		}
			// 		var vBegdaDay = vBegda.getDate();
			// 		if (vBegdaDay.toString().length == 1) {
			// 			vBegdaDay = "0" + vBegdaDay;
			// 		}
			// 		var vEnddaDay = vEndda.getDate();
			// 		if (vEnddaDay.toString().length == 1) {
			// 			vEnddaDay = "0" + vEnddaDay;
			// 		}
			// 		var vKey = vEmpId + vInfty + vSubty + vBegdaYear + vBegdaMonth + vBegdaDay + vEnddaYear + vEnddaMonth + vEnddaDay + vSprps;
			// 		var oRecord = {};
			// 		oRecord.LeaveKey = vKey;
			// 		oRecord.Beguz = vBeguz;
			// 		oRecord.Enduz = vEnduz;
			// 		oRecord.UnitKey = vUnitKey;
			// 		oRecord.Overwrite = true;
			// 		var oModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/MIND2/PEP_YEAR_SRV", {
			// 			refreshAfterChange: true
			// 		});
			// 		oModel.create("/AbsenceSet", oRecord, {
			// 			success: this.createSuccess.bind(this),
			// 			error: function (oError) {
			// 				var aErrorMsg = JSON.parse(oError.responseText).error.innererror.errordetails;
			// 				var aMessageType = aErrorMsg[0].severity;
			// 				if (aMessageType === "warning") {
			// 					Helper.openConfirmDialog("{i18n>areyousure}", aErrorMsg[0].message, "{i18n>yes}", this.overwriteLeave.bind(this), null,
			// 						this);
			// 				} else {
			// 					this.createError(oError);
			// 				}
			// 			}.bind(this)
			// 		});
			// 	}
			// }
		},

		createSuccess: function (oData, oResponse) {
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oSelectedItem = oEmpSelect.getSelectedItem();
			var vEmpId = oSelectedItem.getKey();
			var aCustomData = oSelectedItem.getCustomData();
			var vUnitKey = Helper.getCustomDataValue(aCustomData, "UnitKey");
			var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vCreated = oResourceBundle.getText("leavecreated");
			// this.onEmployeeSelect();
			this.fillLeaveTable();
			this.clearAbsPresInput();
			this.AbsDirty = false;
			MessageToast.show(vCreated);
			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_leave");
			var oAbsenceReason = sap.ui.getCore().byId("ld_select_subty_reason");
			var oCommentAbsenceReason = sap.ui.getCore().byId("ld_inp_subty_reason");
			oAbsenceReason.setSelectedKey("");
			oCommentAbsenceReason.setValue();

			var oYearModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/MIND2/PEP_YEAR_SRV");
			oYearModel.read("/SubtypSet", {
				success: function (oSubtyData) {
					oSubtySelect.removeAllItems();
					var aData = oSubtyData.results;
					var oItem = new sap.ui.core.Item({
						text: "",
						key: ""
					});

					for (var i = 0; i < aData.length; i++) {
						var oTemplate = new sap.ui.core.Item({
							text: aData[i].Subty + " - " + aData[i].SubtyText,
							key: aData[i].Subty,
							customData: [{
								Type: "sap.ui.core.CustomData",
								key: "ganztaegig",
								value: aData[i].Ganztaegig // bind custom data
							}, {
								Type: "sap.ui.core.CustomData",
								key: "Infty",
								value: aData[i].Infty // bind custom data
							}, {
								Type: "sap.ui.core.CustomData",
								key: "ReasonMand",
								value: aData[i].ReasonMand // bind custom data
							}]
						});
						if (i === 0) {
							oSubtySelect.addItem(oItem);
							oSubtySelect.addItem(oTemplate);
							oSubtySelect.setSelectedItem(oItem);
						} else {
							oSubtySelect.addItem(oTemplate);
						}
					}
				}.bind(this),
				filters: [oEmpIdFilter, oUnitFilter]
			});
		},

		createError: function (oError) {
			var aErrorMsg = JSON.parse(oError.responseText).error.innererror.errordetails;
			// var oMessageModel = sap.ui.getCore().getMessageManager().getMessageModel();
			// MessageBox.error(oMessageModel.getData()[1].message);
			MessageBox.error(aErrorMsg[0].message);
		},

		onCancelLeave: function () {
			var oTable = sap.ui.getCore().byId("ld_tbl_leaveoverview");
			if (oTable.getSelectedIndex() !== -1) {
				Helper.openConfirmDialog("{i18n>deleteleavesure}", "{i18n>areyousure}", "{i18n>btndeleteleave}", this.cancelLeave, null,
					this);
			} else {
				Helper.openNoSelectedEntryDialog("{i18n>noselectedEntry}", "{i18n>selectEntry}", null, this);
			}
		},

		onLeaveEntrySelect: function (oEvent) {
			this.AbsDirty = true;
			var oTable = sap.ui.getCore().byId("ld_tbl_leaveoverview");
			var vFirstVisible = oTable.getFirstVisibleRow();
			var oSubtyPicker = sap.ui.getCore().byId("ld_select_subty_leave");

			if (oEvent.getSource().getSelectedIndex() != -1) {
				oSubtyPicker.setEnabled(false);
				var oBegda = sap.ui.getCore().byId("ld_dp_begda_leave");
				var oEndda = sap.ui.getCore().byId("ld_dp_endda_leave");
				var oBeguz = sap.ui.getCore().byId("ld_tp_beguz_leave");
				var oEnduz = sap.ui.getCore().byId("ld_tp_enduz_leave");
				var oSubty = sap.ui.getCore().byId("ld_select_subty_leave");
				var oCbDay = sap.ui.getCore().byId("chb_absence_day");
				var oSprps = sap.ui.getCore().byId("chb_sprps");
				var vRow = oEvent.getSource().getSelectedIndex();
				var oDuration = sap.ui.getCore().byId("ld_inp_duration_leave");
				var oAbsenceReasonSelect = sap.ui.getCore().byId("ld_select_subty_reason");
				var oCommentAbsenceReason = sap.ui.getCore().byId("ld_inp_subty_reason");

				if (vFirstVisible != 0) {
					vRow = vRow - vFirstVisible;
				}

				var vSubtyText = oEvent.getSource().getRows()[vRow].getCells()[0].getText();
				var vBegda = oEvent.getSource().getRows()[vRow].getCells()[1].getText();
				var vEndda = oEvent.getSource().getRows()[vRow].getCells()[2].getText();
				var vCBPrevDay = oEvent.getSource().getRows()[vRow].getCells()[3].getText();
				var vBeguz = oEvent.getSource().getRows()[vRow].getCells()[4].getText();
				var vEnduz = oEvent.getSource().getRows()[vRow].getCells()[5].getText();
				var vSprps = oEvent.getSource().getRows()[vRow].getCells()[6].getText();

				if (oAbsenceReasonSelect.getVisible() == true && oCommentAbsenceReason.getVisible() == true) {
					var vCommentKey = oEvent.getSource().getRows()[vRow].getBindingContext().getObject().CommentKey;
					var vComment = oEvent.getSource().getRows()[vRow].getBindingContext().getObject().Comment;

					oAbsenceReasonSelect.setSelectedKey(vCommentKey);
					oCommentAbsenceReason.setValue(vComment);
				}

				oBegda.setValue(vBegda);
				oEndda.setValue(vEndda);
				oBeguz.setValue(vBeguz);
				oEnduz.setValue(vEnduz);

				if (vSprps == "Ja") {
					oSprps.setSelected(true);
				} else {
					oSprps.setSelected(false);
				}

				if (vCBPrevDay == "Ja") {
					oCbDay.setSelected(true);
				} else {
					oCbDay.setSelected(false);
				}

				var vSubtyKey = oEvent.getSource().getRows()[vRow].getBindingContext().getProperty("Subty");
				oSubty.setSelectedKey(vSubtyKey);
				var bGanztaegig = Helper.getCustomDataValue(oSubty.getSelectedItem().getCustomData(), "ganztaegig");
				if (!bGanztaegig) {
					oBeguz.setVisible(true);
					oEnduz.setVisible(true);
					oDuration.setVisible(true);
				}

			} else {
				this.clearLeaveInput();
			}
			this.toggleEnabledButtons("leave", oEvent.getSource().getSelectedIndex());
		},

		cancelLeave: function (oController) {
			var oTable = sap.ui.getCore().byId("ld_tbl_leaveoverview");
			var oContext = oTable.getContextByIndex(oTable.getSelectedIndex());
			var vSprps = oContext.getObject().Sprps;
			if (!vSprps) {
				var oCurrentDate;
				if (sap.ui.getCore().byId("ld_dp_currentDate")) {
					oCurrentDate = sap.ui.getCore().byId("ld_dp_currentDate");
				}
				var oBegda = sap.ui.getCore().byId("ld_dp_begda_leave");
				var oEndda = sap.ui.getCore().byId("ld_dp_endda_leave");

				oController.getView().getModel().remove(oContext.sPath, {
					success: function () {
						if (oCurrentDate) {
							oBegda.setDateValue(oCurrentDate.getDateValue());
							oEndda.setDateValue(oCurrentDate.getDateValue());
						}
						oController.cancelLeaveSuccess();
					},
					error: function (oError) {
						oTable.setBusy(false);
						oController.createError(oError);
					}
				});
			} else {
				oController.onLeaveLocked();
			}
		},

		onLeaveLocked: function () {
			Helper.openNoSelectedEntryDialog("{i18n>leavelocked}", "{i18n>leavelockedlong}", null, this);
		},

		cancelLeaveSuccess: function () {
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vLeaveDeleted = oResourceBundle.getText("leavedeleted");
			this.fillLeaveTable();
			MessageToast.show(vLeaveDeleted);
			this.onCancelLeaveOverview();
			if (this._oLeaveDialog) {
				this._oLeaveDialog.setBusy(false);
			}
		},

		destroyLeaveCreateDialog: function (oEvent) {
			this._oLeaveDialog.destroy();
			this._oLeaveDialog = null;
		},

		onCloseLeaveDialog: function (oEvent) {
			this._oLeaveDialog.close();
		},

		checkTimeVisibility: function () {
			var oBindingContext = sap.ui.getCore().byId("cl_select_cyclic_event").getSelectedItem().getBindingContext();
			var oBeguz = sap.ui.getCore().byId("ld_tp_beguz_leave");
			var oEnduz = sap.ui.getCore().byId("ld_tp_enduz_leave");
			// var oDuration = sap.ui.getCore().byId("ld_inp_duration_leave");
			// var bGanztaegig = oData.getParameter("data").results[0].Ganztaegig;
			// var bTimeEditable = oData.getParameter("data").results[0].TimeEditable;
			var bGanztaegig = oBindingContext.getProperty("Ganztaegig");
			var bTimeEditable = oBindingContext.getProperty("TimeEditable");
			if (bGanztaegig !== false) {
				oBeguz.setVisible(false);
				oEnduz.setVisible(false);
				// if (oDuration) {
				// 	oDuration.setVisible(false);
				// }
			} else {
				oBeguz.setVisible(true);
				oEnduz.setVisible(true);
				// oDuration.setVisible(true);
			}
			if (bTimeEditable === true) {
				oBeguz.setEditable(true);
				oEnduz.setEditable(true);
			} else {
				oBeguz.setEditable(false);
				oEnduz.setEditable(false);
				// oDuration.setEditable(false);
			}
		},

		onLeaveCyclSubtyChange: function (oEvent) {
			var oBeguz = sap.ui.getCore().byId("ld_tp_beguz_leave");
			var oEnduz = sap.ui.getCore().byId("ld_tp_enduz_leave");
			var oDuration = sap.ui.getCore().byId("ld_inp_duration_leave");
			var bTimeEditable;
			var bFreeDaysVisible;
			if (oEvent.getParameter("selectedItem").getKey()) {
				bTimeEditable = oEvent.getParameter("selectedItem").getAggregation("customData")[6].getProperty("value");
			} else {
				bTimeEditable = false;
			}
			this.AbsDirty = true;
			if (bTimeEditable === true) {
				oBeguz.setEditable(true);
				oEnduz.setEditable(true);
				if (sap.ui.getCore().byId("cl_txt_blanktimes")) {
					sap.ui.getCore().byId("cl_txt_blanktimes").setVisible(true);
				}
			} else {
				if (sap.ui.getCore().byId("cl_txt_blanktimes")) {
					sap.ui.getCore().byId("cl_txt_blanktimes").setVisible(false);
				}
				oBeguz.setEditable(false);
				// oBeguz.setValue(new Date(oEvent.getParameter("selectedItem").getAggregation("customData")[4].getProperty("value").ms).getUTCHours());
				// oBeguz.setValue(oEvent.getParameter("selectedItem").getAggregation("customData")[4].getProperty("value"));
				oBeguz.setValue(this.msToTime(oEvent.getParameter("selectedItem").getAggregation("customData")[4].getProperty("value").ms));
				oBeguz.setModel(this.getView().getModel());

				//schichtstart
				oEnduz.setEditable(false);
				oEnduz.setValue(this.msToTime(oEvent.getParameter("selectedItem").getAggregation("customData")[5].getProperty("value").ms));
				// oEnduz.setValue(new Date(oEvent.getParameter("selectedItem").getAggregation("customData")[5].getProperty("value").ms).getUTCHours());
				// oEnduz.setValue(oEvent.getParameter("selectedItem").getAggregation("customData")[5].getProperty("value"));

			}
			if (oEvent.getParameter("selectedItem").getKey()) {
				var ganztaegig = oEvent.getParameter("selectedItem").getAggregation("customData")[0].getProperty("value");
			} else {
				ganztaegig = true;
			}
			this.AbsDirty = true;
			if (ganztaegig !== false) {
				oBeguz.setVisible(false);
				oEnduz.setVisible(false);
				if (sap.ui.getCore().byId("cl_txt_blanktimes")) {
					sap.ui.getCore().byId("cl_txt_blanktimes").setVisible(false);
				}
				if (oDuration) {
					oDuration.setVisible(false);
				}
			} else {
				if (sap.ui.getCore().byId("cl_txt_blanktimes")) {
					// sap.ui.getCore().byId("cl_txt_blanktimes").setVisible(true);
				}
				oBeguz.setVisible(true);
				oBeguz.setModel(this.getView().getModel());

				//schichtstart
				oEnduz.setVisible(true);
				if (oDuration) {
					oDuration.setVisible(true);
				}
			}
			if (oEvent.getParameter("selectedItem").getKey()) {
				bFreeDaysVisible = oEvent.getParameter("selectedItem").getAggregation("customData")[8].getProperty("value");
			} else {
				bFreeDaysVisible = false;
			}
			if (bFreeDaysVisible === true) {
				sap.ui.getCore().byId("rb_weekly").setSelected(true);
				sap.ui.getCore().byId("pnl_day_week_month").setVisible(false);
				sap.ui.getCore().byId("pnl_daily").setVisible(false);
				sap.ui.getCore().byId("pnl_monthly").setVisible(false);
				sap.ui.getCore().byId("chb_free_days").setSelected(true);
				sap.ui.getCore().byId("l_weekly_everyxweeks").setVisible(false);
				sap.ui.getCore().byId("inp_weekly_everyxweeks").setVisible(false);
				sap.ui.getCore().byId("inp_weekly_everyxweeks").setValue(1);
			} else {
				sap.ui.getCore().byId("pnl_day_week_month").setVisible(true);
				sap.ui.getCore().byId("chb_free_days").setSelected(false);
				sap.ui.getCore().byId("l_weekly_everyxweeks").setVisible(true);
				sap.ui.getCore().byId("inp_weekly_everyxweeks").setVisible(true);
			}
		},

		onLeaveSubtyChange: function (oEvent) {
			var oBeguz = sap.ui.getCore().byId("ld_tp_beguz_leave");
			var oEnduz = sap.ui.getCore().byId("ld_tp_enduz_leave");
			var oDuration = sap.ui.getCore().byId("ld_inp_duration_leave");
			if (oEvent.getParameter("selectedItem").getKey()) {
				var ganztaegig = oEvent.getParameter("selectedItem").getAggregation("customData")[0].getProperty("value");
			} else {
				ganztaegig = true;
			}
			this.AbsDirty = true;
			if (ganztaegig !== false) {
				oBeguz.setVisible(false);
				oEnduz.setVisible(false);
				if (sap.ui.getCore().byId("cl_txt_blanktimes")) {
					sap.ui.getCore().byId("cl_txt_blanktimes").setVisible(false);
				}
				if (oDuration) {
					oDuration.setVisible(false);
				}
			} else {
				if (sap.ui.getCore().byId("cl_txt_blanktimes")) {
					sap.ui.getCore().byId("cl_txt_blanktimes").setVisible(true);
				}
				oBeguz.setVisible(true);
				oBeguz.setModel(this.getView().getModel());

				//schichtstart

				oEnduz.setVisible(true);
				if (oDuration) {
					oDuration.setVisible(true);
				}
			}
		},

		onCancelLeaveOverview: function () {
			this.clearLeaveInput();
			this.toggleEnabledButtons("leave", -1);
			this.clearAbsPresInput();
			var oTable = sap.ui.getCore().byId("ld_tbl_leaveoverview");
			oTable.setSelectedIndex(-1);
		},

		clearLeaveInput: function () {
			var oBeguz = sap.ui.getCore().byId("ld_tp_beguz_leave");
			var oEnduz = sap.ui.getCore().byId("ld_tp_enduz_leave");
			var oDuration = sap.ui.getCore().byId("ld_inp_duration_leave");
			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_leave");
			var oAbsenceReasonSelect = sap.ui.getCore().byId("ld_select_subty_reason");
			var oCommentAbsenceReason = sap.ui.getCore().byId("ld_inp_subty_reason");
			oBeguz.setValue();
			oBeguz.setVisible(false);
			oEnduz.setValue();
			oEnduz.setVisible(false);
			oDuration.setValue();
			oDuration.setVisible(false);
			oSubtySelect.setSelectedKey(0);
			oSubtySelect.setEnabled(true);
			if (oAbsenceReasonSelect.getVisible() == true && oCommentAbsenceReason.getVisible() == true) {
				oAbsenceReasonSelect.setSelectedKey("");
				oCommentAbsenceReason.setValue();
			}
			this.AbsDirty = false;
			if (sap.ui.getCore().byId("chb_sprps")) {
				var oSprps = sap.ui.getCore().byId("chb_sprps");
				oSprps.setSelected(false);
			}
		},

		prepareOVERTIME: function (vUnitKey) {

			if (!this._oOvertimeDialog) {
				this._oOvertimeDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.OvertimeCreate", this, {
					refreshAfterChange: true
				});
				this._oOvertimeDialog.attachAfterClose(this.destroyOvertimeCreateDialog.bind(this));
				this.getView().addDependent(this._oOvertimeDialog);
			}

			var oSelect = sap.ui.getCore().byId("ld_select_emp");

			var oSpecialEntryFilter = new sap.ui.model.Filter("SpecialEntry", sap.ui.model.FilterOperator.EQ, false);
			var oForm = sap.ui.getCore().byId("ld_form");
			oForm.setBusyIndicatorDelay(0);
			oForm.setBusy(true);
			this._oOvertimeDialog.open();
			this._oOvertimeDialog.setBusyIndicatorDelay(0);

			var oModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/MIND2/PEP_YEAR_SRV", {
				refreshAfterChange: true
			});
			var oPlanBegda = this.getSelectedBegda();
			var oPlanEndda = this.getSelectedEndda();
			oPlanBegda.setUTCDate(oPlanBegda.getDate());
			oPlanEndda.setUTCDate(oPlanEndda.getDate());
			var vPlanBegda = this.getFormattedDate(oPlanBegda);
			var vPlanEndda = this.getFormattedDate(oPlanEndda);
			var oPlanBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, vPlanBegda);
			var oPlanEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, vPlanEndda);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			oModel.read("/EmployeeSet", {
				success: function (oData, oResponse) {
					var aData = oData.results;
					for (var i = 0; i < aData.length; i++) {
						var oTemplate = new sap.ui.core.Item({
							text: aData[i].Name,
							key: aData[i].EmpId
						});
						var oCustomData = new sap.ui.core.CustomData({
							key: "UnitKey",
							// writeToDom: true,
							value: aData[i].UnitKey
						});
						oTemplate.addCustomData(oCustomData);

						oSelect.addItem(oTemplate);
						if (i == 0) {
							oSelect.setSelectedItem(oTemplate);
						}
					}
					oForm.setBusy(false);
					this.onEmployeeOvertimeSelect();
				}.bind(this),
				filters: [oSpecialEntryFilter, oUnitFilter, oPlanBegdaFilter, oPlanEnddaFilter]
			});
		},

		onEmployeeOvertimeSelect: function () {
			if (this.isFeatureEnabled("TO_OVERT")) {
				this.fillOvertimeTable();

				var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");

				var oSelectedItem = oEmpSelect.getSelectedItem();
				var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_overtime");
				var vEmpId = oSelectedItem.getKey();

				var aCustomData = oSelectedItem.getCustomData();

				var vUnitKey = Helper.getCustomDataValue(aCustomData, "UnitKey");
				var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
				var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
				var vMessageType = "OVERTIME";
				var oMsgTypeFilter = new sap.ui.model.Filter("MsgType", sap.ui.model.FilterOperator.EQ, vMessageType);

				var oModel = this.getView().getModel();

				oSubtySelect.setModel(oModel);
				var oTemplate = new sap.ui.core.Item({
					text: "{SubtyText}",
					key: "{Subty}"
				});
				oSubtySelect.bindAggregation("items", {
					path: "/subtypOvtSet",
					template: oTemplate,
					filters: [oEmpIdFilter, oUnitFilter]

				});

				var oVerslSelect = sap.ui.getCore().byId("ld_select_versl_overtime");

				oTemplate = new sap.ui.core.Item({
					text: "{VerslText}",
					key: "{Versl}"
				});

				oVerslSelect.setModel(oModel);
				oVerslSelect.bindAggregation("items", {
					path: "/verslSet",
					template: oTemplate,
					filters: [oEmpIdFilter, oUnitFilter]
				});

				var oCommentSelect = sap.ui.getCore().byId("ld_select_comment_overtime");
				var oCommentInput = sap.ui.getCore().byId("ld_inp_comment_overtime");

				var vSumKey = "";
				var oDate = sap.ui.getCore().byId("ld_dp_currentDate").getDateValue();

				var oMsgTypeFilter = new sap.ui.model.Filter("MsgType", sap.ui.model.FilterOperator.EQ, vMessageType);
				var oDateFilter = new sap.ui.model.Filter("PlanDate", sap.ui.model.FilterOperator.EQ, oDate);
				var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
				var oSumFilter = new sap.ui.model.Filter("SumKey", sap.ui.model.FilterOperator.EQ, vSumKey);

				oCommentSelect.setModel(oModel);
				oTemplate = new sap.ui.core.Item({
					text: "{NoteText}",
					key: "{NoteKey}"
				});
				oCommentSelect.bindAggregation("items", {
					path: "/messageNoteSet",
					template: oTemplate,
					filters: [oMsgTypeFilter, oDateFilter, oUnitFilter, oSumFilter],
					events: {
						dataReceived: function () {
							oCommentSelect.setSelectedKey(oCommentSelect.getFirstItem().getKey());
							oCommentInput.setRequired(oCommentSelect.getSelectedKey() == 'SONST');
							//	oCommentInput.setVisible(oCommentSelect.getSelectedKey() === "SONST");
						}.bind(this)
					}
				});
			}
		},

		fillLeaveTable: function () {
			var oTable = sap.ui.getCore().byId("ld_tbl_leaveoverview");
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oModel = this.getView().getModel();
			oTable.setModel(oModel);
			oTable.setBusyIndicatorDelay(0);
			oTable.setBusy(true);

			var oBegda = sap.ui.getCore().byId("ld_dp_begda_leave").getDateValue();
			var oEndda = sap.ui.getCore().byId("ld_dp_endda_leave").getDateValue();

			var oSelectedItem = oEmpSelect.getSelectedItem();
			var vEmpId = oSelectedItem.getKey();
			var aCustomData = oSelectedItem.getCustomData();
			var vUnitKey = Helper.getCustomDataValue(aCustomData, "UnitKey");
			var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.LE, oBegda);
			var oEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.GE, oEndda);
			oTable.bindRows({
				path: "/absenceSet",
				filters: [oEmpIdFilter, oUnitFilter, oBegdaFilter, oEnddaFilter],
				events: {
					dataReceived: function () {
						oTable.setBusy(false);
					}.bind(this)
				}
			});
		},

		fillOvertimeTable: function () {
			var oTable = sap.ui.getCore().byId("ld_tbl_overtimeoverview");
			var vBegdaValue = sap.ui.getCore().byId("ld_dp_begda_overtime").getDateValue();
			var vEnddaValue = sap.ui.getCore().byId("ld_dp_endda_overtime").getDateValue();
			var vBegda = this.getFormattedDate(vBegdaValue);
			var vEndda = this.getFormattedDate(vEnddaValue);
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oModel = this.getView().getModel();

			oTable.setModel(oModel);
			oTable.setBusyIndicatorDelay(0);
			oTable.setBusy(true);
			var oSelectedItem = oEmpSelect.getSelectedItem();
			var vEmpId = oSelectedItem.getKey();
			var aCustomData = oSelectedItem.getCustomData();
			var vUnitKey = Helper.getCustomDataValue(aCustomData, "UnitKey");
			var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
			var oBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.LE, vBegda);
			var oEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.GE, vEndda);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

			oTable.bindRows({
				path: "/overtimeSet",
				filters: [oEmpIdFilter, oUnitFilter, oBegdaFilter, oEnddaFilter],
				events: {
					dataReceived: function () {
						oTable.setBusy(false);
					}
				}
			});
		},

		onSaveOvertime: function (oEvent) {
			var oModel = this.getView().getModel();
			var oTable = sap.ui.getCore().byId("ld_tbl_overtimeoverview");
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var vUnitKey = Helper.getCustomDataValue(oEmpSelect.getSelectedItem().getAggregation("customData"), "UnitKey");
			var oBegda = sap.ui.getCore().byId("ld_dp_begda_overtime");
			var vBegdaValue = oBegda.getDateValue();
			var oEndda = sap.ui.getCore().byId("ld_dp_endda_overtime");
			var vEnddaValue = oEndda.getDateValue();
			var oBeguz = sap.ui.getCore().byId("ld_tp_beguz_overtime");
			var vBeguzValue = oBeguz.getValue();
			var oEnduz = sap.ui.getCore().byId("ld_tp_enduz_overtime");
			var vEnduzValue = oEnduz.getValue();
			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_overtime");
			var oVerslSelect = sap.ui.getCore().byId("ld_select_versl_overtime");
			var oCommentSelect = sap.ui.getCore().byId("ld_select_comment_overtime");
			var oAmount = sap.ui.getCore().byId("ld_inp_amount_overtime");
			var oCommentInput = sap.ui.getCore().byId("ld_inp_comment_overtime");
			var vAmountValue = oAmount.getValue();
			var aAmountParts = vAmountValue.split(".");
			var vAmountStart = aAmountParts[0];
			var vAmountEnd = aAmountParts[1];
			oBegda.setValueState(sap.ui.core.ValueState.None);
			oBegda.setValueStateText("");
			oEndda.setValueState(sap.ui.core.ValueState.None);
			oEndda.setValueStateText("");
			if (vBegdaValue && vEnddaValue) {

				if (!vAmountValue && (!vBeguzValue && !vEnduzValue)) {
					if (!vAmountValue) {
						oAmount.setValueState(sap.ui.core.ValueState.Error);
					} else {
						oBeguz.setValueState(sap.ui.core.ValueState.Error);
						oEnduz.setValueState(sap.ui.core.ValueState.Error);
					}
				} else {

					oAmount.setValueState(sap.ui.core.ValueState.None);
					oBeguz.setValueState(sap.ui.core.ValueState.None);
					oEnduz.setValueState(sap.ui.core.ValueState.None);

					if (!oCommentSelect.getSelectedItem().getKey()) {
						oCommentSelect.setValueState(sap.ui.core.ValueState.Error);
					} else {
						oCommentSelect.setValueState(sap.ui.core.ValueState.None);

						if (!oCommentInput.getValue() && oCommentSelect.getSelectedKey() == 'SONST') {
							oCommentInput.setValueState(sap.ui.core.ValueState.Error);
						} else {
							oCommentInput.setValueState(sap.ui.core.ValueState.None);

							if (!String.prototype.startsWith) {
								String.prototype.startsWith = function (search, pos) {
									return this.substr(!pos || pos < 0 ? 0 : +pos, search.length) == search;
								};
							}

							if ((vAmountEnd && vAmountEnd.length <= 2) && !vAmountStart.match("^-") || !vAmountValue || vAmountValue && !vAmountValue.match(
									"^-")) {
								oTable.setBusy(true);
								var vSubty = oSubtySelect.getSelectedItem().getKey();
								var vEmpId = oEmpSelect.getSelectedItem().getKey();
								var vVersl = oVerslSelect.getSelectedItem().getKey();
								var vBegdaYear = (vBegdaValue.getYear() + 1900).toString();
								var vEnddaYear = (vEnddaValue.getYear() + 1900).toString();
								var vBegdaMonth = (vBegdaValue.getMonth() + 1).toString();
								if (vBegdaValue <= vEnddaValue) {
									if (vBegdaMonth.toString().length == 1) {
										vBegdaMonth = "0" + vBegdaMonth;
									}
									var vEnddaMonth = (vEnddaValue.getMonth() + 1).toString();
									if (vEnddaMonth.toString().length == 1) {
										vEnddaMonth = "0" + vEnddaMonth;
									}
									var vBegdaDay = (vBegdaValue.getDate()).toString();
									if (vBegdaDay.toString().length == 1) {
										vBegdaDay = "0" + vBegdaDay;
									}
									var vEnddaDay = (vEnddaValue.getDate()).toString();
									if (vEnddaDay.toString().length == 1) {
										vEnddaDay = "0" + vEnddaDay;
									}

									var vCommentKey = oCommentSelect.getSelectedItem().getKey();

									var oRecord = {};
									oRecord.EmpId = vEmpId;
									oRecord.Subty = vSubty;
									oRecord.Versl = vVersl;
									oRecord.Begda = vBegdaYear.toString() + vBegdaMonth.toString() + vBegdaDay.toString();
									oRecord.Endda = vEnddaYear.toString() + vEnddaMonth.toString() + vEnddaDay.toString();
									oRecord.StartTime = vBeguzValue;
									oRecord.EndTime = vEnduzValue;
									oRecord.Amount = vAmountValue;
									oRecord.CommentKey = vCommentKey;
									oRecord.UnitKey = vUnitKey;
									oRecord.Comment = oCommentInput.getValue();

									oModel.create("/overtimeSet", oRecord, {
										refreshAfterChange: true,
										success: function () {

											this.createOvertimeSuccess(this);
											oTable.setBusy(false);
										}.bind(this),
										error: function (oError) {
											this.createError(oError);
											this.clearOvertimeInput();
											this.toggleEnabledButtons("overtime", -1);
											oTable.setBusy(false);
										}.bind(this)
									});
								} else {
									oBegda.setValueState(sap.ui.core.ValueState.Error);
									oBegda.setValueStateText(this.getResourceBundleText("errormsgdates"));
									oEndda.setValueState(sap.ui.core.ValueState.Error);
									oEndda.setValueStateText(this.getResourceBundleText("errormsgdates"));
								}
							} else {
								if (vAmountValue) {
									oAmount.setValueState(sap.ui.core.ValueState.Error);
								}
							}
						}
					}
				}

			} else {
				oTable.setBusy(false);
				if (!vBegdaValue) {
					oBegda.setValueState(sap.ui.core.ValueState.Error);
				} else {
					oBegda.setValueState(sap.ui.core.ValueState.None);
				}
				if (!vEnddaValue) {
					oEndda.setValueState(sap.ui.core.ValueState.Error);
				} else {
					oEndda.setValueState(sap.ui.core.ValueState.None);
				}
				if ((vAmountEnd && vAmountEnd.length > 2) || vAmountStart.match("^-")) {
					oAmount.setValueState(sap.ui.core.ValueState.Error);
				} else {
					oAmount.setValueState(sap.ui.core.ValueState.None);
				}
			}

		},

		createOvertimeSuccess: function () {

			this.clearOvertimeInput();
			this.toggleEnabledButtons("overtime", -1);
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vOvertimeCreated = oResourceBundle.getText("overtimecreated");
			this.onEmployeeOvertimeSelect();
			this.OvertimeDirty = false;
			MessageToast.show(vOvertimeCreated);
			this.clearOvertimeInput();
		},

		onUpdateOvertime: function () {
			var oModel = this.getView().getModel();
			var oTable = sap.ui.getCore().byId("ld_tbl_overtimeoverview");
			var oContext = oTable.getContextByIndex(oTable.getSelectedIndex());
			var oBegda = sap.ui.getCore().byId("ld_dp_begda_overtime");
			var vBegdaValue = oBegda.getDateValue();
			var oEndda = sap.ui.getCore().byId("ld_dp_endda_overtime");
			var vEnddaValue = oEndda.getDateValue();
			var oBeguz = sap.ui.getCore().byId("ld_tp_beguz_overtime");
			var vBeguzValue = oBeguz.getValue();
			var oEnduz = sap.ui.getCore().byId("ld_tp_enduz_overtime");
			var vEnduzValue = oEnduz.getValue();
			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_overtime");
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oVerslSelect = sap.ui.getCore().byId("ld_select_versl_overtime");
			var oCommentSelect = sap.ui.getCore().byId("ld_select_comment_overtime");
			var oAmount = sap.ui.getCore().byId("ld_inp_amount_overtime");
			var oCbDay = sap.ui.getCore().byId("chb_absence_day");
			var vAmountValue = oAmount.getValue();
			var aAmountParts = vAmountValue.split(".");
			var vAmountStart = aAmountParts[0];
			var vAmountEnd = aAmountParts[1];
			var oCommentInput = sap.ui.getCore().byId("ld_inp_comment_overtime");

			if (vBegdaValue && vEnddaValue) {

				if (!vAmountValue && (!vBeguzValue && !vEnduzValue)) {
					if (!vAmountValue) {
						oAmount.setValueState(sap.ui.core.ValueState.Error);
					} else {
						oBeguz.setValueState(sap.ui.core.ValueState.Error);
						oEnduz.setValueState(sap.ui.core.ValueState.Error);
					}
				} else {

					oAmount.setValueState(sap.ui.core.ValueState.None);
					oBeguz.setValueState(sap.ui.core.ValueState.None);
					oEnduz.setValueState(sap.ui.core.ValueState.None);

					if (!oCommentSelect.getSelectedItem().getKey()) {
						oCommentSelect.setValueState(sap.ui.core.ValueState.Error);
					} else {
						oCommentSelect.setValueState(sap.ui.core.ValueState.None);

						if (!oCommentInput.getValue() && oCommentSelect.getSelectedKey() == 'SONST') {
							oCommentInput.setValueState(sap.ui.core.ValueState.Error);
						} else {
							oCommentInput.setValueState(sap.ui.core.ValueState.None);

							if (!String.prototype.startsWith) {
								String.prototype.startsWith = function (search, pos) {
									return this.substr(!pos || pos < 0 ? 0 : +pos, search.length) == search;
								};
							}

							if ((vAmountEnd && vAmountEnd.length <= 2) && !vAmountStart.match("^-") || !vAmountValue || vAmountValue && !vAmountValue.match(
									"^-")) {
								var vSubty = oSubtySelect.getSelectedItem().getKey();
								var vEmpId = oEmpSelect.getSelectedItem().getKey();
								var vVersl = oVerslSelect.getSelectedItem().getKey();
								var vBegdaYear = (vBegdaValue.getYear() + 1900).toString();
								var vEnddaYear = (vEnddaValue.getYear() + 1900).toString();
								var vBegdaMonth = (vBegdaValue.getMonth() + 1).toString();
								if (vBegdaValue <= vEnddaValue) {
									if (vBegdaMonth.toString().length === 1) {
										vBegdaMonth = "0" + vBegdaMonth;
									}
									var vEnddaMonth = (vEnddaValue.getMonth() + 1).toString();
									if (vEnddaMonth.toString().length === 1) {
										vEnddaMonth = "0" + vEnddaMonth;
									}
									var vBegdaDay = (vBegdaValue.getDate()).toString();
									if (vBegdaDay.toString().length === 1) {
										vBegdaDay = "0" + vBegdaDay;
									}
									var vEnddaDay = (vEnddaValue.getDate()).toString();
									if (vEnddaDay.toString().length === 1) {
										vEnddaDay = "0" + vEnddaDay;
									}

									var vCommentKey = oCommentSelect.getSelectedItem().getKey();

									var oRecord = {};
									oRecord.EmpId = vEmpId;
									oRecord.Subty = vSubty;
									oRecord.Versl = vVersl;
									oRecord.Begda = vBegdaYear.toString() + vBegdaMonth.toString() + vBegdaDay.toString();
									oRecord.Endda = vEnddaYear.toString() + vEnddaMonth.toString() + vEnddaDay.toString();
									oRecord.StartTime = vBeguzValue;
									oRecord.EndTime = vEnduzValue;
									oRecord.Amount = vAmountValue;
									oRecord.CommentKey = vCommentKey;
									oRecord.Comment = oCommentInput.getValue();

									oModel.update(oContext.sPath, oRecord, {
										refreshAfterChange: true,
										success: function () {
											this.updateOvertimeSuccess();
											oTable.setBusy(false);
										}.bind(this),
										error: function () {
											this.createError.bind(this);
											oTable.setBusy(false);
										}.bind(this)
									});
								} else {
									oBegda.setValueState(sap.ui.core.ValueState.Error);
									oBegda.setValueStateText(this.getResourceBundleText("errormsgdates"));
									oEndda.setValueState(sap.ui.core.ValueState.Error);
									oEndda.setValueStateText(this.getResourceBundleText("errormsgdates"));
									oTable.setBusy(false);
								}
							} else {
								if (vAmountValue) {
									oAmount.setValueState(sap.ui.core.ValueState.Error);
									oTable.setBusy(false);
								}
							}
						}
					}
				}

			} else {
				oTable.setBusy(false);
				if (!vBegdaValue) {
					oBegda.setValueState(sap.ui.core.ValueState.Error);
				} else {
					oBegda.setValueState(sap.ui.core.ValueState.None);
				}
				if (!vEnddaValue) {
					oEndda.setValueState(sap.ui.core.ValueState.Error);
				} else {
					oEndda.setValueState(sap.ui.core.ValueState.None);
				}
				if ((vAmountEnd && vAmountEnd.length > 2) || vAmountStart.match("^-")) {
					oAmount.setValueState(sap.ui.core.ValueState.Error);
				} else {
					oAmount.setValueState(sap.ui.core.ValueState.None);
				}
			}

		},

		updateLeaveSuccess: function () {
			this.clearLeaveInput();
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vLeaveUpdated = oResourceBundle.getText("leaveupdated");
			this.onEmployeeSelect();
			this.AbsDirty = false;
			this.toggleEnabledButtons("leave", -1);
			MessageToast.show(vLeaveUpdated);
		},

		updateOvertimeSuccess: function () {

			this.clearOvertimeInput();
			this.OvertimeDirty = false;
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vOvertimeUpdated = oResourceBundle.getText("overtimeupdated");
			this.onEmployeeOvertimeSelect();
			this.toggleEnabledButtons("overtime", -1);
			MessageToast.show(vOvertimeUpdated);
		},

		onCancelOvertime: function (oEvent) {
			var oTable = sap.ui.getCore().byId("ld_tbl_overtimeoverview");
			if (oTable.getSelectedIndex() !== -1) {
				Helper.openConfirmDialog("{i18n>deleteovertimesure}", "{i18n>areyousure}", "{i18n>cancelovertime}", this.cancelOvertime,
					oEvent,
					this);
			} else {
				Helper.openNoSelectedEntryDialog("{i18n>noselectedEntry}", "{i18n>selectEntry}", null, this);
			}
		},

		cancelOvertime: function (oController) {
			var oTable = sap.ui.getCore().byId("ld_tbl_overtimeoverview");
			var oContext = oTable.getContextByIndex(oTable.getSelectedIndex());
			var oModel = oController.getView().getModel();

			oModel.remove(oContext.sPath, {
				success: function () {
					oTable.setBusy(false);
					oController.cancelOvertimeSuccess();
				},
				error: function (oError) {
					oTable.setBusy(false);
					oController.createError(oError);
				}
			});
		},

		cancelOvertimeSuccess: function () {
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vOvertimeDeleted = oResourceBundle.getText("overtimedeleted");
			var oTable = sap.ui.getCore().byId("ld_tbl_overtimeoverview");
			this.OvertimeDirty = false;
			this.toggleEnabledButtons("overtime", -1);
			this.fillOvertimeTable();
			MessageToast.show(vOvertimeDeleted);
			oTable.setBusy(false);
		},

		destroyOvertimeCreateDialog: function () {
			this._oOvertimeDialog.destroy();
			this._oOvertimeDialog = null;
		},

		onCloseOvertimeDialog: function () {
			this._oOvertimeDialog.close();
		},

		checkComment: function () {
			var oComment = sap.ui.getCore().byId("ld_select_comment_overtime");
			var oCommentInput = sap.ui.getCore().byId("ld_inp_comment_overtime");
			oCommentInput.setRequired(oComment.getSelectedKey() == 'SONST');
			//	oCommentInput.setVisible(oComment.getSelectedKey() == 'SONST');
		},

		checkCommentAbsenceReason: function () {
			var oComment = sap.ui.getCore().byId("ld_select_subty_reason");
			var oCommentSelected = oComment.getSelectedItem().getBindingContext().getObject();
			var oCommentInput = sap.ui.getCore().byId("ld_inp_subty_reason");

			oCommentInput.setVisible(true);
			oCommentInput.setRequired(oCommentSelected.TextRequired);
		},

		clearOvertimeInput: function () {
			this.OvertimeDirty = false;
			var oBegda = sap.ui.getCore().byId("ld_dp_begda_overtime");
			var oEndda = sap.ui.getCore().byId("ld_dp_endda_overtime");
			if (sap.ui.getCore().byId("ld_dp_currentDate")) {
				oBegda.setValue(sap.ui.getCore().byId("ld_dp_currentDate").getValue());
				oEndda.setValue(sap.ui.getCore().byId("ld_dp_currentDate").getValue());
			}
			var oBeguz = sap.ui.getCore().byId("ld_tp_beguz_overtime");
			oBeguz.setValue();
			var oEnduz = sap.ui.getCore().byId("ld_tp_enduz_overtime");
			oEnduz.setValue();
			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_overtime");
			oSubtySelect.setSelectedKey();
			oSubtySelect.setEnabled(true);
			var oVerslSelect = sap.ui.getCore().byId("ld_select_versl_overtime");
			oVerslSelect.setSelectedKey();
			var oAmount = sap.ui.getCore().byId("ld_inp_amount_overtime");
			oAmount.setValue();
			var oComment = sap.ui.getCore().byId("ld_select_comment_overtime");
			oComment.setSelectedKey();
			var oCommentInput = sap.ui.getCore().byId("ld_inp_comment_overtime");

			// var oTable = sap.ui.getCore().byId("ld_tbl_overtimeoverview");
			// oTable.setSelectedIndex(0);
			oCommentInput.setRequired(oComment.getSelectedKey() == 'SONST');
			//oCommentInput.setVisible(oComment.getSelectedKey() == 'SONST');
			oCommentInput.setValue();

		},

		onOvertimeEntrySelect: function (oEvent) {

			this.OvertimeDirty = true;
			var oTable = sap.ui.getCore().byId("ld_tbl_overtimeoverview");
			var vFirstVisible = oTable.getFirstVisibleRow();

			if (oEvent.getSource().getSelectedIndex() != -1) {
				var oBegda = sap.ui.getCore().byId("ld_dp_begda_overtime");
				var oEndda = sap.ui.getCore().byId("ld_dp_endda_overtime");
				var oBeguz = sap.ui.getCore().byId("ld_tp_beguz_overtime");
				var oEnduz = sap.ui.getCore().byId("ld_tp_enduz_overtime");
				var oSubty = sap.ui.getCore().byId("ld_select_subty_overtime");
				var oVersl = sap.ui.getCore().byId("ld_select_versl_overtime");
				var oComment = sap.ui.getCore().byId("ld_select_comment_overtime");
				var oAmount = sap.ui.getCore().byId("ld_inp_amount_overtime");
				var oCommentInput = sap.ui.getCore().byId("ld_inp_comment_overtime");

				var vRow = oEvent.getParameter("rowIndex");

				if (vFirstVisible != 0) {
					vRow = vRow - vFirstVisible;
				}

				var vSubtyText = oEvent.getSource().getRows()[vRow].getCells()[0].getText();
				var vVerslText = oEvent.getSource().getRows()[vRow].getCells()[1].getText();
				var vBegda = oEvent.getSource().getRows()[vRow].getCells()[2].getText();
				var vEndda = oEvent.getSource().getRows()[vRow].getCells()[3].getText();
				var vBeguz = oEvent.getSource().getRows()[vRow].getCells()[4].getText();
				var vEnduz = oEvent.getSource().getRows()[vRow].getCells()[5].getText();
				var vAmount = oEvent.getSource().getRows()[vRow].getCells()[6].getText().replace(",", ".");

				// CEPOI_EXT 12.02.2021 >>>
				// oBegda.setValue(vBegda);
				// oEndda.setValue(vEndda);
				oBegda.setDateValue(new Date(vBegda.substr(6, 4), vBegda.substr(3, 2) - 1, vBegda.substr(0, 2)));
				oEndda.setDateValue(new Date(vEndda.substr(6, 4), vEndda.substr(3, 2) - 1, vEndda.substr(0, 2)));
				// <<<
				oBeguz.setValue(vBeguz);
				oEnduz.setValue(vEnduz);
				oAmount.setValue(vAmount);

				for (var i = 0; i < oSubty.getItems().length; i++) {
					if (oSubty.getItems()[i].getText() == vSubtyText) {
						oSubty.setSelectedKey(oSubty.getItems()[i].getKey());
						oSubty.setEnabled(false);
						break;
					}
				}

				for (i = 0; i < oVersl.getItems().length; i++) {
					if (oVersl.getItems()[i].getText() == vVerslText) {
						oVersl.setSelectedKey(oVersl.getItems()[i].getKey());
						break;
					}
				}

				oComment.setSelectedKey(oEvent.getSource().getContextByIndex(vRow).getProperty("CommentKey"));
				oCommentInput.setValue(oEvent.getSource().getContextByIndex(vRow).getProperty("Comment"));
				oCommentInput.setRequired(oComment.getSelectedKey() == 'SONST');
				//oCommentInput.setVisible(oComment.getSelectedKey() == 'SONST');

			} else {
				this.clearOvertimeInput();
			}

			var vIsCico = false;
			if (vSubtyText == "") {
				vIsCico = true;
			}
			this.toggleEnabledButtons("overtime", oEvent.getSource().getSelectedIndex(), vIsCico);
		},

		onCancelOvertimeOverview: function () {
			this.clearOvertimeInput();
			this.OvertimeDirty = false;
			var oTable = sap.ui.getCore().byId("ld_tbl_overtimeoverview");
			oTable.setSelectionMode("Single");
		},

		prepareCICO: function (vUnitKey) {
			if (!this._oCicoDialog) {
				this._oCicoDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.CicoCreate", this, {
					refreshAfterChange: true
				});
				this._oCicoDialog.attachAfterClose(this.destroyCicoDialog.bind(this));
				this.getView().addDependent(this._oCicoDialog);
			}
			var vToday = new Date();
			vToday.setHours(12);
			var oDate = sap.ui.getCore().byId("ld_dp_date");
			oDate.setDateValue(vToday);

			var oForm = sap.ui.getCore().byId("ld_form");
			oForm.setBusyIndicatorDelay(0);
			oForm.setBusy(true);
			this._oCicoDialog.open();
			this._oCicoDialog.setBusyIndicatorDelay(0);
			this._oCicoDialog.setBusy(true);

			this._oCicoDialog.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));

			var oModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/MIND2/PEP_YEAR_SRV", {
				refreshAfterChange: true
			});

			this.bindEmployeeSet(oModel, vUnitKey);
			this.getTimeEventSet(vUnitKey);
			this._oCicoDialog.setBusy(false);
			oForm.setBusy(false);
		},

		// CEPOI_EXT 24.02.2021 >>>
		onCicoEntrySelect: function (oEvent) {
			if (oEvent.getSource().getSelectedIndex() != -1) {
				var oEventSelect = sap.ui.getCore().byId("ld_select_timeevent");
				var oContext = oEvent.getSource().getContextByIndex(oEvent.getSource().getSelectedIndex());

				// sap.ui.getCore().byId("ld_dp_date").setValue(oContext.getProperty().Ldate);
				// sap.ui.getCore().byId("ld_tp_uz").setValue(oContext.getProperty().Ltime);	
				var oDate = sap.ui.getCore().byId("ld_dp_date");
				var oTime = sap.ui.getCore().byId("ld_tp_uz");
				// var vDate = oContext.getProperty().Ldate;
				// var vTime = oContext.getProperty().Ltime;
				var TZOffsetMs = new Date(0).getTimezoneOffset() * 60 * 1000;
				var oTimeFormatter = sap.ui.core.format.DateFormat.getDateInstance({
					pattern: "HH:mm:ss"
				});
				oDate.setDateValue(oContext.getProperty().Ldate);
				oTime.setValue(oTimeFormatter.format(new Date(oContext.getProperty().Ltime.ms + TZOffsetMs)));

				sap.ui.getCore().byId("chb_cico_day").setSelected(oContext.getProperty().Prev);
				if (sap.ui.getCore().byId("ld_inp_aufnr")) {
					sap.ui.getCore().byId("ld_inp_aufnr").setValue(oContext.getProperty().Aufnr);
					sap.ui.getCore().byId("ld_inp_matnr").setValue(oContext.getProperty().Matnr);
					sap.ui.getCore().byId("ld_inp_zulage").setValue(oContext.getProperty().Zulage);
					sap.ui.getCore().byId("ld_inp_kostenst").setValue(oContext.getProperty().Kostenst);
				}

				for (var i = 0; i < oEventSelect.getItems().length; i++) {
					if (oEventSelect.getItems()[i].getText() == oContext.getProperty().TimeeventText) {
						oEventSelect.setSelectedKey(oEventSelect.getItems()[i].getKey());
						break;
					}
				}
			} else {
				this.clearCicoInput();
			}
			this.toggleEnabledButtons("cico", oEvent.getSource().getSelectedIndex());
		},
		// <<<

		prepareSHIFTSUB: function (vUnitKey) {
			if (!this._oShiftSubstitutionDialog) {
				this._oShiftSubstitutionDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.ShiftSubstitution", this, {
					refreshAfterChange: true
				});
				// if (this.isFeatureEnabled("SUBSTONLY")) {
				// sap.ui.getCore().byId("chb_substShifts").setVisible(false);
				// sap.ui.getCore().byId("chb_substShiftsSubty").setVisible(false);
				// sap.ui.getCore().byId("chb_substUnit").setVisible(false);
				// }
				this._oShiftSubstitutionDialog.attachAfterClose(this.destroyShiftSubstitutionDialog.bind(this));
				this.getView().addDependent(this._oShiftSubstitutionDialog);
				this._oShiftSubstitutionDialog.open();
			}
			this._oShiftSubstitutionDialog.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));

			var oSelEmpFrom = sap.ui.getCore().byId("ld_select_empfrom");
			var oSelEmpTo = sap.ui.getCore().byId("ld_select_empto");
			this.bindEmployeesToSelect(oSelEmpFrom, vUnitKey);
			this.bindEmployeesToSelect(oSelEmpTo, vUnitKey);
		},

		onSelectShiftSubstitutionShift: function (oEvent) {
			sap.ui.getCore().byId("chb_substShiftsSubty").setEnabled(oEvent.getSource().getSelected());
		},

		onSaveShiftSubst: function () {
			var oModel = this.getView().getModel();
			var oDpStartDate = sap.ui.getCore().byId("ld_dp_startDate");
			var oDpEndDate = sap.ui.getCore().byId("ld_dp_endDate");
			var oBegda = oDpStartDate.getDateValue();
			var oEndda = oDpEndDate.getDateValue();

			if (oBegda && oEndda) {
				var oSelEmpFrom = sap.ui.getCore().byId("ld_select_empfrom");
				var oSelEmpTo = sap.ui.getCore().byId("ld_select_empto");
				var vUnitKey = Helper.getCustomDataValue(this._oShiftSubstitutionDialog.getAggregation("customData"), "UnitKey");
				var oNewSubst = {};

				this._oShiftSubstitutionDialog.setBusy(true);

				oDpStartDate.setValueState(sap.ui.core.ValueState.None);
				oDpEndDate.setValueState(sap.ui.core.ValueState.None);

				oBegda.setHours(12);
				oEndda.setHours(12);

				oNewSubst.OrigEmp = oSelEmpFrom.getSelectedKey();
				oNewSubst.NewEmp = oSelEmpTo.getSelectedKey();
				oNewSubst.Begda = oBegda;
				oNewSubst.Endda = oEndda;
				oNewSubst.UnitKey = vUnitKey;

				if (this.isFeatureEnabled("SUBSTONLY")) {
					oNewSubst.Subty = "07";
					oNewSubst.SubstShift = true;
				} else {
					var oCbQual = sap.ui.getCore().byId("chb_substUnit");
					var oCbShift = sap.ui.getCore().byId("chb_substShifts");
					var oCbSubty = sap.ui.getCore().byId("chb_substShiftsSubty");

					oNewSubst.SubstQual = oCbQual.getSelected();
					oNewSubst.SubstShift = oCbShift.getSelected();

					if (oCbSubty.getVisible()) {
						if (oCbSubty.getSelected()) {
							oNewSubst.Subty = "07";
						} else {
							oNewSubst.Subty = "02";
						}
					}
				}

				oModel.create("/empSubstitutionSet", oNewSubst, {
					success: function () {
						this._oShiftSubstitutionDialog.setBusy(false);
						var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
						var vSuccess = oResourceBundle.getText("shiftsubsuccess");
						MessageToast.show(vSuccess);
					}.bind(this),
					error: function () {
						this._oShiftSubstitutionDialog.setBusy(false);
					}.bind(this)
				});
			} else {
				oDpStartDate.setValueState(sap.ui.core.ValueState.Error);
				oDpEndDate.setValueState(sap.ui.core.ValueState.Error);
			}

		},

		bindEmployeesToSelect: function (oSelect, vUnitKey) {
			var oModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/MIND2/PEP_YEAR_SRV", {
				refreshAfterChange: true
			});
			var oTemplate = new sap.ui.core.Item({
				text: "{Name}",
				key: "{EmpId}"
			});
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

			oSelect.setModel(oModel);
			oSelect.bindItems({
				path: "/EmployeeSet",
				template: oTemplate,
				filters: [oUnitFilter]
			});
		},

		onSaveCyclicLeave: function (oEvent) {
			var oNewLeave = this.buildCyclicLeave();
			var oTable = sap.ui.getCore().byId("ld_tbl_cyclicleaveoverview");
			var oModel = this.getView().getModel();
			oTable.setBusy(true);
			if (oNewLeave.hasOwnProperty("Pernr")) {
				oModel.create("/cyclicLeaveSet", oNewLeave, {
					success: function () {
						// this.fillCyclicLeaveTable();
						this.clearCyclicLeavePopup();
						var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
						var vModified = oResourceBundle.getText("saved");
						// oTable.refreshAggregation("rows"); //hier
						oTable.setBusy(false);
						MessageToast.show(vModified);
					}.bind(this),
					error: function (oError) {
						oTable.setBusy(false);
						this.createError(oError);
					}.bind(this)
				});
			} else {
				oTable.setBusy(false);
			}
		},

		onUpdateCyclicLeave: function (oEvent) {
			var oNewLeave = this.buildCyclicLeave();

			if (oNewLeave) {
				var oTable = sap.ui.getCore().byId("ld_tbl_cyclicleaveoverview");
				// var oBindingContext = oTable.getContextByIndex(oTable.getSelectedIndex());
				var oBindingContext = oTable.getSelectedContexts()[0];

				oNewLeave.Id = oTable.getModel().getProperty("Id", oBindingContext);
				oTable.setBusy(true);
				this.getView().getModel().update(oBindingContext.sPath, oNewLeave, {
					refreshAfterChange: true,
					success: function () {
						this.fillCyclicLeaveTable();
						this.clearCyclicLeavePopup();
						var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
						var vModified = oResourceBundle.getText("saved");
						oTable.setBusy(false);
						MessageToast.show(vModified);
					}.bind(this),
					error: function (oError) {
						oTable.setBusy(false);
						this.createError(oError);
					}.bind(this)
				});
			}
		},

		onDeleteCyclicLeave: function (oEvent) {
			var oTable = sap.ui.getCore().byId("ld_tbl_cyclicleaveoverview");
			if (oTable.getSelectedItems().length === 0) {
				return;
			}

			var oBindingContext = oTable.getSelectedContexts()[0];
			oTable.setBusy(true);
			this.getView().getModel().remove(oBindingContext.sPath, {
				success: function () {
					this.fillCyclicLeaveTable();
					this.clearCyclicLeavePopup();
					var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
					var vModified = oResourceBundle.getText("cyclicleavedelete");
					oTable.setBusy(false);
					MessageToast.show(vModified);
				}.bind(this),
				error: function (oError) {
					oTable.setBusy(false);
					this.createError(oError);
				}.bind(this)
			});

		},

		buildCyclicLeave: function () {
			var oNewLeave = {};
			var oRBDaily = sap.ui.getCore().byId("rb_daily");
			var oRBWeekly = sap.ui.getCore().byId("rb_weekly");
			var oRBMonthly = sap.ui.getCore().byId("rb_monthly");
			var vDaily = oRBDaily.getSelected();
			var vWeekly = oRBWeekly.getSelected();
			var vMonthly = oRBMonthly.getSelected();
			var oSelEmployee = sap.ui.getCore().byId("ld_select_emp");
			var oSubtySelect = sap.ui.getCore().byId("cl_select_cyclic_event");
			var oTimeFormatter = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "PTHH'H'mm'M'ss'S'"
			});
			var vSufficient = false;
			var oSubtyContext = oSubtySelect.getSelectedItem().getBindingContext();
			var vUnitKey = Helper.getCustomDataValue(this._oCyclicLeaveDialog.getAggregation("customData"), "UnitKey");
			var oBeguzSelect = sap.ui.getCore().byId("ld_tp_beguz_leave");
			var oEnduzSelect = sap.ui.getCore().byId("ld_tp_enduz_leave");
			if (oBeguzSelect.getVisible()) {
				var oBeguz = oBeguzSelect.getDateValue();
				var oEnduz = oEnduzSelect.getDateValue();
				if (oBeguz && oEnduz) {
					var vBeguzString = oTimeFormatter.format(new Date(oBeguz));
					var vEnduzString = oTimeFormatter.format(new Date(oEnduz));
					// oBeguzSelect.setValueState(sap.ui.core.ValueState.None);
					// oEnduzSelect.setValueState(sap.ui.core.ValueState.None);
					oNewLeave.BeginTime = vBeguzString;
					oNewLeave.EndTime = vEnduzString;
					// } else {
					// 	oBeguzSelect.setValueState(sap.ui.core.ValueState.Error);
					// 	oEnduzSelect.setValueState(sap.ui.core.ValueState.Error);
				}
			}
			oNewLeave.Pernr = oSelEmployee.getSelectedKey();
			oNewLeave.Subty = oSubtyContext.getProperty("Subty");
			oNewLeave.SubtyText = oSubtyContext.getProperty("SubtyText");
			oNewLeave.Infty = oSubtyContext.getProperty("Infty");
			oNewLeave.UnitKey = vUnitKey;
			oNewLeave.Tprog = oSubtyContext.getProperty("Tprog");
			oNewLeave.FeatureKey = oSubtyContext.getProperty("FeatureKey");
			if (vDaily) {
				oNewLeave.Type = "1";
				var oRBDailyEvery = sap.ui.getCore().byId("rb_daily_every");
				//var oRBDailyWeekday = sap.ui.getCore().byId("rb_daily_weekday");

				var vRBDailyEvery = oRBDailyEvery.getSelected();
				//var vRBDailyWeekday = oRBDailyWeekday.getSelected();

				if (vRBDailyEvery) {
					var oInpDailyDay = sap.ui.getCore().byId("inp_daily_days");
					oNewLeave.DAmountDays = parseInt(oInpDailyDay.getValue());
					if (oNewLeave.DAmountDays) {
						vSufficient = true;
						oInpDailyDay.setValueState(sap.ui.core.ValueState.None);
					} else {
						oInpDailyDay.setValueState(sap.ui.core.ValueState.Error);
					}
				}

			} else if (vWeekly) {
				oNewLeave.Type = "2";
				oNewLeave.WEveryXWeeks = parseInt(sap.ui.getCore().byId("inp_weekly_everyxweeks").getValue());
				if (!oNewLeave.WEveryXWeeks) {
					oNewLeave.WEveryXWeeks = 1;
				}
				if (this.isFeatureEnabled("CYCCUSTBT1")) oNewLeave.CustomKey1 = sap.ui.getCore().byId("chb_free_days").getSelected();
				oNewLeave.Monday = sap.ui.getCore().byId("chb_monday").getSelected();
				oNewLeave.Tuesday = sap.ui.getCore().byId("chb_tuesday").getSelected();
				oNewLeave.Wednesday = sap.ui.getCore().byId("chb_wednesday").getSelected();
				oNewLeave.Thursday = sap.ui.getCore().byId("chb_thursday").getSelected();
				oNewLeave.Friday = sap.ui.getCore().byId("chb_friday").getSelected();
				oNewLeave.Saturday = sap.ui.getCore().byId("chb_saturday").getSelected();
				oNewLeave.Sunday = sap.ui.getCore().byId("chb_sunday").getSelected();
				if (oNewLeave.WEveryXWeeks && (oNewLeave.Monday || oNewLeave.Tuesday || oNewLeave.Wednesday || oNewLeave.Thursday || oNewLeave.Friday ||
						oNewLeave.Saturday || oNewLeave.Sunday)) {
					vSufficient = true;
					sap.ui.getCore().byId("inp_weekly_everyxweeks").setValueState(sap.ui.core.ValueState.None);
					sap.ui.getCore().byId("chb_monday").setValueState(sap.ui.core.ValueState.None);
					sap.ui.getCore().byId("chb_tuesday").setValueState(sap.ui.core.ValueState.None);
					sap.ui.getCore().byId("chb_wednesday").setValueState(sap.ui.core.ValueState.None);
					sap.ui.getCore().byId("chb_thursday").setValueState(sap.ui.core.ValueState.None);
					sap.ui.getCore().byId("chb_friday").setValueState(sap.ui.core.ValueState.None);
					sap.ui.getCore().byId("chb_saturday").setValueState(sap.ui.core.ValueState.None);
					sap.ui.getCore().byId("chb_sunday").setValueState(sap.ui.core.ValueState.None);
				} else {
					sap.ui.getCore().byId("inp_weekly_everyxweeks").setValueState(sap.ui.core.ValueState.Error);
					sap.ui.getCore().byId("chb_monday").setValueState(sap.ui.core.ValueState.Error);
					sap.ui.getCore().byId("chb_tuesday").setValueState(sap.ui.core.ValueState.Error);
					sap.ui.getCore().byId("chb_wednesday").setValueState(sap.ui.core.ValueState.Error);
					sap.ui.getCore().byId("chb_thursday").setValueState(sap.ui.core.ValueState.Error);
					sap.ui.getCore().byId("chb_friday").setValueState(sap.ui.core.ValueState.Error);
					sap.ui.getCore().byId("chb_saturday").setValueState(sap.ui.core.ValueState.Error);
					sap.ui.getCore().byId("chb_sunday").setValueState(sap.ui.core.ValueState.Error);
				}

			} else if (vMonthly) {
				oNewLeave.Type = "3";
				var oRBMonthlyDay = sap.ui.getCore().byId("rb_month_day");
				var oRBMonthlyWeekDay = sap.ui.getCore().byId("rb_month_weekday");

				var vRBMonthlyDay = oRBMonthlyDay.getSelected();
				var vRBMonthlyWeekDay = oRBMonthlyWeekDay.getSelected();

				if (vRBMonthlyDay) {
					var oInpMonthDay = sap.ui.getCore().byId("inp_month_day_day");

					if (parseInt(oInpMonthDay.getValue()) > 28) {
						var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
						var vModified = oResourceBundle.getText("over28");
						MessageToast.show(vModified);
					}

					oNewLeave.MEveryXDay = parseInt(sap.ui.getCore().byId("inp_month_day_day").getValue());
					oNewLeave.MEveryXMonth = parseInt(sap.ui.getCore().byId("inp_month_day_month").getValue());
					if (oNewLeave.MEveryXDay && oNewLeave.MEveryXMonth) {
						vSufficient = true;
						sap.ui.getCore().byId("inp_month_day_day").setValueState(sap.ui.core.ValueState.None);
						sap.ui.getCore().byId("inp_month_day_month").setValueState(sap.ui.core.ValueState.None);
					} else {
						sap.ui.getCore().byId("inp_month_day_day").setValueState(sap.ui.core.ValueState.Error);
						sap.ui.getCore().byId("inp_month_day_month").setValueState(sap.ui.core.ValueState.Error);
					}

				} else if (vRBMonthlyWeekDay) {
					oNewLeave.MRepeatQuantity = sap.ui.getCore().byId("sel_month_weekday_week").getValue();
					oNewLeave.MRepeatWeekday = sap.ui.getCore().byId("sel_month_weekday_day").getValue();
					oNewLeave.MEveryXMonth = parseInt(sap.ui.getCore().byId("sel_month_weekday_month").getValue());
					if ((oNewLeave.MRepeatQuantity && oNewLeave.MRepeatWeekday && oNewLeave.MEveryXMonth)) {
						vSufficient = true;
						sap.ui.getCore().byId("sel_month_weekday_week").setValueState(sap.ui.core.ValueState.None);
						sap.ui.getCore().byId("sel_month_weekday_day").setValueState(sap.ui.core.ValueState.None);
						sap.ui.getCore().byId("sel_month_weekday_month").setValueState(sap.ui.core.ValueState.None);
					} else {
						sap.ui.getCore().byId("sel_month_weekday_week").setValueState(sap.ui.core.ValueState.Error);
						sap.ui.getCore().byId("sel_month_weekday_day").setValueState(sap.ui.core.ValueState.Error);
						sap.ui.getCore().byId("sel_month_weekday_month").setValueState(sap.ui.core.ValueState.Error);
					}

				}

			}

			var oBegdaSelect = sap.ui.getCore().byId("ld_dp_begda_leave");
			var oEnddaSelect = sap.ui.getCore().byId("ld_dp_endda_leave");
			var oBegda = oBegdaSelect.getDateValue();
			var oEndda = oEnddaSelect.getDateValue();
			if (oBegda && oEndda && (oBegda <= oEndda)) {
				oBegda.setHours(12);
				oEndda.setHours(12);
				oBegdaSelect.setValueState(sap.ui.core.ValueState.None);
				oEnddaSelect.setValueState(sap.ui.core.ValueState.None);
				oNewLeave.BeginDate = oBegda;
				oNewLeave.EndDate = oEndda;
			} else {
				oBegdaSelect.setValueState(sap.ui.core.ValueState.Error);
				oEnddaSelect.setValueState(sap.ui.core.ValueState.Error);
				vSufficient = false;
			}
			if (vSufficient) {
				return oNewLeave;
			} else {
				return {};
			}

		},

		onCyclicLeaveEntrySelect: function (oEvent) {
			var vBindingContext = oEvent.getSource().getSelectedContexts()[0];
			var oSourceModel = oEvent.getSource().getModel();
			switch (oSourceModel.getProperty("Type", vBindingContext)) {
			case "1":
				sap.ui.getCore().byId("rb_daily").setSelected(true);
				sap.ui.getCore().byId("rb_weekly").setSelected(false);
				sap.ui.getCore().byId("rb_monthly").setSelected(false);

				sap.ui.getCore().byId("rb_daily_every").setSelected(true);
				sap.ui.getCore().byId("inp_daily_days").setValue(oSourceModel.getProperty("DAmountDays", vBindingContext));

				break;
			case "2":
				sap.ui.getCore().byId("rb_daily").setSelected(false);
				sap.ui.getCore().byId("rb_weekly").setSelected(true);
				sap.ui.getCore().byId("rb_monthly").setSelected(false);

				sap.ui.getCore().byId("inp_weekly_everyxweeks").setValue(oSourceModel.getProperty("WEveryXWeeks", vBindingContext));

				if (oSourceModel.getProperty("CustomKey1", vBindingContext) === true) {
					sap.ui.getCore().byId("chb_free_days").setSelected(true);
					sap.ui.getCore().byId("chb_free_days").setEnabled(false);
					// sap.ui.getCore().byId("chb_free_days").setVisible(true);
					sap.ui.getCore().byId("l_weekly_everyxweeks").setVisible(false);
					sap.ui.getCore().byId("inp_weekly_everyxweeks").setVisible(false);
					sap.ui.getCore().byId("inp_weekly_everyxweeks").setValue(1);
				} else {
					sap.ui.getCore().byId("chb_free_days").setVisible(false);
					sap.ui.getCore().byId("l_weekly_everyxweeks").setVisible(true);
					sap.ui.getCore().byId("inp_weekly_everyxweeks").setVisible(true);
				}

				sap.ui.getCore().byId("chb_monday").setSelected(oSourceModel.getProperty("Monday", vBindingContext));
				sap.ui.getCore().byId("chb_tuesday").setSelected(oSourceModel.getProperty("Tuesday", vBindingContext));
				sap.ui.getCore().byId("chb_wednesday").setSelected(oSourceModel.getProperty("Wednesday", vBindingContext));
				sap.ui.getCore().byId("chb_thursday").setSelected(oSourceModel.getProperty("Thursday", vBindingContext));
				sap.ui.getCore().byId("chb_friday").setSelected(oSourceModel.getProperty("Friday", vBindingContext));
				sap.ui.getCore().byId("chb_saturday").setSelected(oSourceModel.getProperty("Saturday", vBindingContext));
				sap.ui.getCore().byId("chb_sunday").setSelected(oSourceModel.getProperty("Sunday", vBindingContext));

				break;
			case "3":
				sap.ui.getCore().byId("rb_daily").setSelected(false);
				sap.ui.getCore().byId("rb_weekly").setSelected(false);
				sap.ui.getCore().byId("rb_monthly").setSelected(true);

				if (oSourceModel.getProperty("MEveryXDay", vBindingContext) > 0) {
					sap.ui.getCore().byId("rb_month_day").setSelected(true);
					sap.ui.getCore().byId("rb_month_weekday").setSelected(false);

					sap.ui.getCore().byId("inp_month_day_day").setValue(oSourceModel.getProperty("MEveryXDay", vBindingContext));
					sap.ui.getCore().byId("inp_month_day_month").setValue(oSourceModel.getProperty("MEveryXMonth", vBindingContext));
				} else if (oSourceModel.getProperty("Type", vBindingContext) === "3") {
					sap.ui.getCore().byId("rb_month_day").setSelected(false);
					sap.ui.getCore().byId("rb_month_weekday").setSelected(true);

					sap.ui.getCore().byId("sel_month_weekday_week").setSelectedKey(oSourceModel.getProperty("MRepeatQuantity", vBindingContext));
					sap.ui.getCore().byId("sel_month_weekday_day").setSelectedKey(oSourceModel.getProperty("MRepeatWeekday", vBindingContext));
					sap.ui.getCore().byId("sel_month_weekday_month").setValue(oSourceModel.getProperty("MEveryXMonth", vBindingContext));
				}

				break;
			}

			// sap.ui.getCore().byId("ld_tp_beguz_leave").setVisible(true);
			// sap.ui.getCore().byId("ld_tp_enduz_leave").setVisible(true);
			// sap.ui.getCore().byId("ld_tp_beguz_leave").setEditable(false);
			// sap.ui.getCore().byId("ld_tp_enduz_leave").setEditable(false);

			sap.ui.getCore().byId("cl_select_cyclic_event").setSelectedKey(oSourceModel.getProperty("SubtyId", vBindingContext));
			this.checkTimeVisibility();
			// setValue(oSourceModel.getProperty("SubtyText", vBindingContext));

			// sap.ui.getCore().byId("ld_tp_beguz_leave").setValue(new Date(vBindingContext.getObject().BeginTime.ms).getUTCHours());
			sap.ui.getCore().byId("ld_tp_beguz_leave").setValue(this.msToTime(vBindingContext.getObject().BeginTime.ms));
			// sap.ui.getCore().byId("ld_tp_beguz_leave").bindValue(vBindingContext.getProperty("BeginTime"));
			sap.ui.getCore().byId("ld_tp_enduz_leave").setValue(this.msToTime(vBindingContext.getObject().EndTime.ms));
			// sap.ui.getCore().byId("ld_tp_enduz_leave").setValue(new Date(vBindingContext.getObject().EndTime.ms).getUTCHours());
			// sap.ui.getCore().byId("ld_tp_enduz_leave").setValue(oSourceModel.getProperty("EndTime", vBindingContext));

			sap.ui.getCore().byId("ld_dp_begda_leave").setDateValue(oSourceModel.getProperty("BeginDate", vBindingContext));
			sap.ui.getCore().byId("ld_dp_endda_leave").setDateValue(oSourceModel.getProperty("EndDate", vBindingContext));

			sap.ui.getCore().byId("btn_cyclicleaveSave").setEnabled(false);
			sap.ui.getCore().byId("btn_cyclicleaveEdit").setEnabled(true);
			sap.ui.getCore().byId("btn_cyclicleaveCancel").setEnabled(true);

			this.showCyclicLeavePanel();
		},

		// onCyclicLeaveEntrySelect: function (oEvent) {

		// 	if (oEvent.getSource().getSelectedIndex() == -1) {
		// 		this.clearCyclicLeavePopup();
		// 		return;
		// 	}

		// 	var vBindingContext = oEvent.getSource().getContextByIndex(oEvent.getSource().getSelectedIndex());
		// 	var oSourceModel = oEvent.getSource().getModel();

		// 	switch (oSourceModel.getProperty("Type", vBindingContext)) {
		// 	case "1":
		// 		sap.ui.getCore().byId("rb_daily").setSelected(true);
		// 		sap.ui.getCore().byId("rb_weekly").setSelected(false);
		// 		sap.ui.getCore().byId("rb_monthly").setSelected(false);

		// 		sap.ui.getCore().byId("rb_daily_every").setSelected(true);
		// 		sap.ui.getCore().byId("inp_daily_days").setValue(oSourceModel.getProperty("DAmountDays", vBindingContext));

		// 		break;
		// 	case "2":
		// 		sap.ui.getCore().byId("rb_daily").setSelected(false);
		// 		sap.ui.getCore().byId("rb_weekly").setSelected(true);
		// 		sap.ui.getCore().byId("rb_monthly").setSelected(false);

		// 		sap.ui.getCore().byId("inp_weekly_everyxweeks").setValue(oSourceModel.getProperty("WEveryXWeeks", vBindingContext));
		// 		sap.ui.getCore().byId("chb_monday").setSelected(oSourceModel.getProperty("Monday", vBindingContext));
		// 		sap.ui.getCore().byId("chb_tuesday").setSelected(oSourceModel.getProperty("Tuesday", vBindingContext));
		// 		sap.ui.getCore().byId("chb_wednesday").setSelected(oSourceModel.getProperty("Wednesday", vBindingContext));
		// 		sap.ui.getCore().byId("chb_thursday").setSelected(oSourceModel.getProperty("Thursday", vBindingContext));
		// 		sap.ui.getCore().byId("chb_friday").setSelected(oSourceModel.getProperty("Friday", vBindingContext));
		// 		sap.ui.getCore().byId("chb_saturday").setSelected(oSourceModel.getProperty("Saturday", vBindingContext));
		// 		sap.ui.getCore().byId("chb_sunday").setSelected(oSourceModel.getProperty("Sunday", vBindingContext));

		// 		break;
		// 	case "3":
		// 		sap.ui.getCore().byId("rb_daily").setSelected(false);
		// 		sap.ui.getCore().byId("rb_weekly").setSelected(false);
		// 		sap.ui.getCore().byId("rb_monthly").setSelected(true);

		// 		if (oSourceModel.getProperty("MEveryXDay", vBindingContext) > 0) {
		// 			sap.ui.getCore().byId("rb_month_day").setSelected(true);
		// 			sap.ui.getCore().byId("rb_month_weekday").setSelected(false);

		// 			sap.ui.getCore().byId("inp_month_day_day").setValue(oSourceModel.getProperty("MEveryXDay", vBindingContext));
		// 			sap.ui.getCore().byId("inp_month_day_month").setValue(oSourceModel.getProperty("MEveryXMonth", vBindingContext));
		// 		} else if (oSourceModel.getProperty("Type", vBindingContext) == "3") {
		// 			sap.ui.getCore().byId("rb_month_day").setSelected(false);
		// 			sap.ui.getCore().byId("rb_month_weekday").setSelected(true);

		// 			sap.ui.getCore().byId("sel_month_weekday_week").setSelectedKey(oSourceModel.getProperty("MRepeatQuantity", vBindingContext));
		// 			sap.ui.getCore().byId("sel_month_weekday_day").setSelectedKey(oSourceModel.getProperty("MRepeatWeekday", vBindingContext));
		// 			sap.ui.getCore().byId("sel_month_weekday_month").setValue(oSourceModel.getProperty("MEveryXMonth", vBindingContext));
		// 		}

		// 		break;
		// 	}

		// 	sap.ui.getCore().byId("ld_tp_beguz_leave").setValue(oSourceModel.getProperty("BeginTime", vBindingContext));
		// 	sap.ui.getCore().byId("ld_tp_enduz_leave").setValue(oSourceModel.getProperty("EndTime", vBindingContext));

		// 	sap.ui.getCore().byId("ld_dp_begda_leave").setDateValue(oSourceModel.getProperty("BeginDate", vBindingContext));
		// 	sap.ui.getCore().byId("ld_dp_endda_leave").setDateValue(oSourceModel.getProperty("EndDate", vBindingContext));

		// 	sap.ui.getCore().byId("btn_cyclicleaveSave").setEnabled(false);
		// 	sap.ui.getCore().byId("btn_cyclicleaveEdit").setEnabled(true);
		// 	sap.ui.getCore().byId("btn_cyclicleaveCancel").setEnabled(true);

		// 	this.showCyclicLeavePanel();

		// },

		clearCyclicLeavePopup: function () {
			sap.ui.getCore().byId("rb_daily").setSelected(true);
			sap.ui.getCore().byId("rb_weekly").setSelected(false);
			sap.ui.getCore().byId("rb_monthly").setSelected(false);

			sap.ui.getCore().byId("ld_tp_beguz_leave").setValue("");
			sap.ui.getCore().byId("ld_tp_enduz_leave").setValue("");

			sap.ui.getCore().byId("rb_daily_every").setSelected(true);
			sap.ui.getCore().byId("inp_daily_days").setValue("");

			sap.ui.getCore().byId("rb_month_day").setSelected(true);
			sap.ui.getCore().byId("rb_month_weekday").setSelected(false);

			sap.ui.getCore().byId("inp_month_day_day").setValue("");
			sap.ui.getCore().byId("inp_month_day_month").setValue("");

			sap.ui.getCore().byId("ld_dp_begda_leave").setValue("");
			sap.ui.getCore().byId("ld_dp_endda_leave").setValue("");

			sap.ui.getCore().byId("inp_weekly_everyxweeks").setValue("");

			sap.ui.getCore().byId("l_weekly_everyxweeks").setVisible(true);
			sap.ui.getCore().byId("inp_weekly_everyxweeks").setVisible(true);

			sap.ui.getCore().byId("chb_free_days").setEnabled(true);
			sap.ui.getCore().byId("chb_free_days").setSelected(false);

			sap.ui.getCore().byId("chb_monday").setSelected(false);
			sap.ui.getCore().byId("chb_tuesday").setSelected(false);
			sap.ui.getCore().byId("chb_wednesday").setSelected(false);
			sap.ui.getCore().byId("chb_thursday").setSelected(false);
			sap.ui.getCore().byId("chb_friday").setSelected(false);
			sap.ui.getCore().byId("chb_saturday").setSelected(false);
			sap.ui.getCore().byId("chb_sunday").setSelected(false);

			sap.ui.getCore().byId("sel_month_weekday_week").setSelectedKey("1");
			sap.ui.getCore().byId("sel_month_weekday_day").setSelectedKey("1");
			sap.ui.getCore().byId("sel_month_weekday_month").setValue("");

			sap.ui.getCore().byId("ld_tbl_cyclicleaveoverview").removeSelections();
			sap.ui.getCore().byId("btn_cyclicleaveSave").setEnabled(true);
			sap.ui.getCore().byId("btn_cyclicleaveEdit").setEnabled(false);
			sap.ui.getCore().byId("btn_cyclicleaveCancel").setEnabled(false);

			this.showCyclicLeavePanel();
		},

		onEmployeeCyclicLeaveSelect: function () {
			this.updateSubtyInCyclicLeave();
		},

		prepareSORTEMP: function (vUnitKey) {
			if (!this._oEmployeeSortDialog) {
				this._oEmployeeSortDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.EmployeeSort", this, {
					refreshAfterChange: true
				});
				this.getView().addDependent(this._oEmployeeSortDialog);
				this._oEmployeeSortDialog.open();
				this._oEmployeeSortDialog.attachAfterClose(this.destroyEmployeeSortDialog.bind(this));
				this._oEmployeeSortDialog.setBusyIndicatorDelay(0);
				this._oEmployeeSortDialog.setBusy(true);
			}
			this._oEmployeeSortDialog.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));

			var oModel = this.getView().getModel();
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

			oModel.read("/empSortSet", {
				filters: [oUnitFilter],
				success: function (data) {
					var oDataModel = new sap.ui.model.json.JSONModel(data.results);

					sap.ui.getCore().byId('idSortEmp').setModel(oDataModel, "empList");
				}
			});
			/*var oVBox = sap.ui.getCore().byId("vb_sort_employees");

			var oTemplate = new sap.m.FlexBox({});

			var oInput = new sap.m.Input({
				type: "Number",
				value: {
					path: 'SortNumber',
					formatter: function (vValue) {
						var vInt = parseInt(vValue, 10);
						vValue = vInt.toString();
						return vValue;
					}
				}
			});

			var oInputName = new sap.m.Input({
				editable: false,
				width: "300px",
				value: {
					parts: ['EmpId',
						'Name'
					],
					formatter: function (vValue, vName) {
						var vInt = parseInt(vValue, 10);
						vValue = vInt.toString();
						return vValue + ' - ' + vName;
					}
				},
				enabled: false
			});

			oTemplate.addItem(oInput);
			oTemplate.addItem(oInputName);

			var dPlanBegda = this.getSelectedBegda();
			var vBegda = this.getFormattedDate(dPlanBegda);
			var dPlanEndda = this.getSelectedEndda();
			var vEndda = this.getFormattedDate(dPlanEndda);
			oModel.setHeaders({
				"planBegda": vBegda,
				"planEndda": vEndda
			});*/

			/*oVBox.setModel(oModel);
			oVBox.bindAggregation("items", {
				path: "/empSortSet",
				filters: [oUnitFilter],
				template: oTemplate,
				events: {
					dataReceived: function () {
						this._oEmployeeSortDialog.setBusy(false);
					}.bind(this)
				}
			});*/

			// sap.ui.getCore().byId('idSortEmp').getBinding('items').filter(oUnitFilter);
			this._oEmployeeSortDialog.setBusy(false);
		},

		onEmployeeSortDrop: function (oEvent) {
			var oDrag = oEvent.getParameter("draggedControl"),
				oDrop = oEvent.getParameter("droppedControl"),
				sWhere = oEvent.getParameter("dropPosition");

			var oData = oDrag.getModel("empList").oData,
				iFrom = parseInt(oDrag.getBindingContextPath().replace('/', '')),
				iTo = parseInt(oDrop.getBindingContextPath().replace('/', ''));

			if (sWhere === "After") iTo += 1;

			oData.splice(iTo, 0, oData.splice(iFrom, 1)[0]);
			oDrag.getModel("empList").setData(oData);
		},

		saveEmpSort: function () {
			var oModel = this.getView().getModel();
			// var oEmpSort = sap.ui.getCore().byId("vb_sort_employees");
			var oEmpSort = sap.ui.getCore().byId("idSortEmp");
			var aItems = oEmpSort.getItems();
			var aNumbers = [];
			var oObject = {};
			var vAlreadyInNumbers = false;
			var vError = false;
			var vUnitKey = Helper.getCustomDataValue(this._oEmployeeSortDialog.getAggregation("customData"), "UnitKey");

			// for (var i = 0; i < aItems.length; i++) {
			// 	if (aItems[i].getItems()[0].getValue()) {
			// 		vAlreadyInNumbers = false;
			// 		for (var k = 0; k < aNumbers.length; k++) {
			// 			if (aItems[i].getItems()[0].getValue() == aNumbers[k]) {
			// 				vAlreadyInNumbers = true;
			// 			}
			// 		}
			// 		if (vAlreadyInNumbers) {
			// 			aItems[i].getItems()[0].setValueState(sap.ui.core.ValueState.Error);
			// 			vError = true;
			// 			break;
			// 		} else {
			// 			aNumbers.push(aItems[i].getItems()[0].getValue());
			// 			aItems[i].getItems()[0].setValueState(sap.ui.core.ValueState.None);
			// 		}
			// 	} else {
			// 		aItems[i].getItems()[0].setValueState(sap.ui.core.ValueState.Error);
			// 		vError = true;
			// 		break;
			// 	}
			// }

			// if (!vError) {
			for (var j = 0; j < aItems.length; j++) {
				oObject = {};
				oObject = aItems[j].getBindingContext("empList").getObject();

				var snLength = oObject.SortNumber.length;

				oObject.UnitKey = vUnitKey;
				oObject.SortNumber = parseInt(aItems[j].getBindingContextPath().replace('/', '')) + 1;
				oObject.SortNumber = oObject.SortNumber.toFixed();

				snLength -= oObject.SortNumber.length;
				var sArr = oObject.SortNumber.split('');

				for (var z = 0; z < snLength; z++) {
					sArr.unshift('0');
				}

				oObject.SortNumber = sArr.join('');
				oModel.create("/empSortSet", oObject);
			}
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vSuccess = oResourceBundle.getText("sortsaved");
			MessageToast.show(vSuccess);
			// }

		},

		onChangeEmpSort: function (oEvent) {
			var oEmpSortList = sap.ui.getCore().byId("li_employeesort");
			var sDropPosition = oEvent.getParameter("dropPosition");
			var oDraggedControl = oEvent.getParameter("draggedControl"); //das Control was angeklickt und gezigen wird
			var oDroppedControl = oEvent.getParameter("droppedControl"); //das Control vor oder hinter dem abgelegt wird

			var vStartIndex = oEmpSortList.indexOfItem(oDraggedControl);
			var vStartBindingContext = oDraggedControl.getBindingContext();
			var vTargetIndex = oEmpSortList.indexOfItem(oDroppedControl);

			if (sDropPosition === "Before") {
				if (vStartIndex < vTargetIndex) {
					vTargetIndex--;
				}
			} else if (sDropPosition === "After") {
				if (vStartIndex > vTargetIndex) {
					vTargetIndex++;
				}
			}

			var aOldEmpListItems = oEmpSortList.getAggregation("items");
			var aNewEmpListItems = [];

			for (var i = 0; i < aOldEmpListItems.length; i++) {
				if ((i < vStartIndex && i < vTargetIndex) || i > vStartIndex && i > vTargetIndex) {
					aNewEmpListItems[i] = aOldEmpListItems[i];
				} else if (i == vStartIndex) {
					aNewEmpListItems[vTargetIndex] = aOldEmpListItems[i];
				} else if ((i < vTargetIndex && i > vStartIndex) && vStartIndex < vTargetIndex) {
					aNewEmpListItems[i - 1] = aOldEmpListItems[i];
				} else if ((i > vTargetIndex && i < vStartIndex) && vStartIndex > vTargetIndex) {
					aNewEmpListItems[i + 1] = aOldEmpListItems[i];
				} else if (i == vTargetIndex && vStartIndex < vTargetIndex) {
					aNewEmpListItems[i - 1] = aOldEmpListItems[i];
				} else if (i == vTargetIndex && vStartIndex > vTargetIndex) {
					aNewEmpListItems[i + 1] = aOldEmpListItems[i];
				}
			}
			var oTemplate = new sap.m.ObjectListItem({
				title: "{EmpId} - {Name}",
				number: "{SortNumber}"
			});

			var oEmpListModel = oEmpSortList.getModel();
			oEmpListModel.setProperty("EmpId", 10, vStartBindingContext);

			var oSorter = new sap.ui.model.Sorter('EmpId');
			var oEmpbinding = oEmpSortList.getBinding("items");

		},

		closeSortEmp: function (oEvent) {
			this._oEmployeeSortDialog.close();
			var vUnitKey = Helper.getCustomDataValue(this._oEmployeeSortDialog.getAggregation("customData"), "UnitKey");
			this.onRefreshUnit(vUnitKey);
		},

		prepareNEWSLET: function (vUnitKey) {
			if (!this._oNewsletterDialog) {
				this._oNewsletterDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.Newsletter", this, {
					refreshAfterChange: true
				});
				this.getView().addDependent(this._oNewsletterDialog);
				this._oNewsletterDialog.setModel(new sap.ui.model.json.JSONModel(), 'NewsletterModel');
				this._oNewsletterDialog.getModel('NewsletterModel').setProperty("/RadioIndex", 0);
				this._oNewsletterDialog.open();
				this._oNewsletterDialog.attachAfterClose(this.destroyNewsletterDialog.bind(this));
			}

			this._oNewsletterDialog.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));

			// var oModel = this.getView().getModel();
			var vBegda = this.getSelectedBegda();
			var vEndda = this.getSelectedEndda();

			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, vBegda);
			var oEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, vEndda);
			// var oVBox = sap.ui.getCore().byId("vb_mails");
			var oList = sap.ui.getCore().byId("vb_mails");

			// var oTemplate = new sap.m.CheckBox({
			// 	text: "{Name} - {Mail}"
			// });
			// oVBox.setModel(oModel);
			// oVBox.bindAggregation("items", {
			// 	path: "/newsletterSet",
			// 	filters: [oUnitFilter, oBegdaFilter, oEnddaFilter],
			// 	template: oTemplate,
			// 	events: {
			// 		dataReceived: function () {}.bind(this)
			// 	}
			// });

			oList.getBinding('items').filter([oUnitFilter, oBegdaFilter, oEnddaFilter]);
			if (oList.getBinding('items').isSuspended()) oList.getBinding('items').resume();

			this.addMailAdressToNewsletter();
		},

		addMailAdressToNewsletter: function () {
			var oSF = sap.ui.getCore().byId("sf_newmails");
			var oContent = oSF.getContent();
			var oElementsInSf = 0;
			if (oContent.length > 0) {
				var oOldButton = oContent[oContent.length - 1];
				oSF.removeContent(oContent.length - 1);
				oOldButton.destroy();
				oElementsInSf = oContent.length;
			}
			var oNewMailInput = new sap.m.Input("inp_addMail_" + (oElementsInSf + 1), {
				type: "Email",
				layoutData: new sap.ui.layout.GridData({
					span: "XL11 L11 M11 S11"
				})
			});
			oSF.addContent(oNewMailInput);
			var oAddMailButton = new sap.m.Button("btn_addMail_" + (oElementsInSf + 1), {
				icon: "sap-icon://add",
				press: this.addMailAdressToNewsletter.bind(this),
				layoutData: new sap.ui.layout.GridData({
					span: "XL1 L1 M1 S1"
				})
			});
			oSF.addContent(oAddMailButton);

		},

		onRemoveNewsletter: function () {
			var oList = sap.ui.getCore().byId("vb_mails");
			var oModel = this.getView().getModel();
			var aItems = oList.getSelectedItems();
			var bNonDeletable = false;

			aItems.forEach(function (item) {
				var oContext = item.getBindingContext();
				if (!oContext.getProperty("IsCustomMail")) {
					bNonDeletable = true;
					return;
				}
				oModel.remove(oContext.getPath());
			});

			if (bNonDeletable) {
				sap.m.MessageToast.show(this.getView().getModel("i18n").getResourceBundle().getText("NonDeletableNewsletterAlert"));
			}
		},

		sendNewsletter: function (vKey, bValid) {
			var oModel = this.getView().getModel();
			var oSF = sap.ui.getCore().byId("sf_newmails");
			var oElement;
			var oObject = {};
			var oDataModel = this._oNewsletterDialog.getModel('NewsletterModel');
			var vUnitKey = Helper.getCustomDataValue(this._oNewsletterDialog.getAggregation("customData"), "UnitKey");

			//Validierung der eingegeben Mails bevor der Mailversand angestoßen wird
			var email;
			var mailregex = /^\w+[\w-+\.]*\@\w+([-\.]\w+)*\.[a-zA-Z]{2,}$/;
			for (var k = 0; k < oSF.getContent().length; k++) {
				oElement = oSF.getContent()[k];
				if (oElement.getId().match("^inp")) {
					email = oElement.getValue();

					if (!email) {
						break;
					}

					if (!mailregex.test(email)) {
						oElement.setValueState("Error");
						return;
					} else {
						oElement.setValueState("None");
					}
				}
			}

			var oRadioBtnGroup = sap.ui.getCore().byId("rbg_timeFrame");
			var oRadioButton = oRadioBtnGroup.getSelectedButton();
			var vNumWeeks = oDataModel.getProperty("/RadioIndex") === 3 && oDataModel.getProperty("/CustomWeekCount") || Helper.getCustomDataValue(
				oRadioButton.getCustomData(), "weeks");

			var oEndda = new Date();
			oEndda = this.getSelectedBegda();
			for (var k = 0; k < vNumWeeks; k++) {
				oEndda.setDate(oEndda.getDate() + 7);
			}

			oEndda.setDate(oEndda.getDate() - 1);

			//yannick peter ruppert
			if (bValid != true) { //also check for validation feature 
				this.checkOpenMsgBeforeExport(new Date(), oEndda,
					"sendNewsletter",
					vUnitKey);
				return;
			}

			//ende

			for (var j = 0; j < oSF.getContent().length; j++) {
				oElement = oSF.getContent()[j];

				if (oElement.getId().match("^inp")) {
					oObject = {};
					oObject.Begda = new Date();
					oObject.Endda = oEndda;
					oObject.Mail = oSF.getContent()[j].getValue();
					oObject.UnitKey = vUnitKey;
					oObject.IsNewMail = true;
					oModel.create("/newsletterSet", oObject, {
						groupId: j
					});
				}
			}

			var oVBox = sap.ui.getCore().byId("vb_mails");
			var aItems = oVBox.getItems();

			for (var i = 0; i < aItems.length; i++) {
				oObject = {};
				oObject = aItems[i].getBindingContext().getObject();
				oObject.Endda = oEndda;
				if (aItems[i].getSelected()) {
					oModel.create("/newsletterSet", oObject, {
						groupId: i
					});
				}
			}

			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vSent = oResourceBundle.getText("plansent");
			MessageToast.show(vSent);

			this._oNewsletterDialog.setBusy(true);
			this.closeNewsletterPopUp();
		},

		destroyNewsletterDialog: function () {
			this._oNewsletterDialog.destroy();
			this._oNewsletterDialog = null;
		},

		closeNewsletterPopUp: function () {
			this._oNewsletterDialog.close();
		},

		prepareDEFQUAL: function (vUnitKey) {
			if (!this._oDefaultQualificationDialog) {
				this._oDefaultQualificationDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.ChangeDefaultQualification", this, {
					refreshAfterChange: true
				});
				this.getView().addDependent(this._oDefaultQualificationDialog);
				this._oDefaultQualificationDialog.open();
				this._oDefaultQualificationDialog.attachAfterClose(this.destroyDefaultQualificationDialog.bind(this));
				var oDatePicker = sap.ui.getCore().byId("ld_dp_cdq_begda");
				oDatePicker.setDateValue(this.getSelectedBegda());
				var oMinDate = new Date();
				oDatePicker.setMinDate(oMinDate);
				var oDate = oDatePicker.getDateValue();
				if (oDate < oMinDate) {
					oDatePicker.setDateValue(oMinDate);
				}
			}

			this._oDefaultQualificationDialog.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));

			this.bindDefaultQualificationEmployees(vUnitKey);
		},

		bindDefaultQualificationEmployees: function (vUnitKey) {
			var oTemplate = new sap.ui.core.Item({
				text: "{Name}",
				key: "{EmpId}"
			});
			var oModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/MIND2/PEP_YEAR_SRV", {
				refreshAfterChange: true
			});
			var oEmpSelect = sap.ui.getCore().byId("ld_select_cdq_employee");
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oPlanBegda = this.getSelectedBegda();
			var oPlanEndda = this.getSelectedEndda();
			oPlanBegda.setUTCDate(oPlanBegda.getDate());
			oPlanEndda.setUTCDate(oPlanEndda.getDate());
			var vPlanBegda = this.getFormattedDate(oPlanBegda);
			var vPlanEndda = this.getFormattedDate(oPlanEndda);
			var oBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, vPlanBegda);
			var oEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, vPlanEndda);

			oEmpSelect.setModel(oModel);
			oEmpSelect.bindItems({
				path: "/EmployeeSet",
				template: oTemplate,
				filters: [oUnitFilter, oBegdaFilter, oEnddaFilter],
				events: {
					dataReceived: function () {
						this.bindDefaultQualificationTable(sap.ui.getCore().byId("ld_select_cdq_employee").getAggregation("items")[0].getKey());
						this.bindDefaultQualificationQuals(vUnitKey, sap.ui.getCore().byId("ld_select_cdq_employee").getAggregation("items")[0].getKey());
					}.bind(this)
				}
			});

		},

		changeSelectedDefQualEmp: function (oEvent) {
			var vUnitKey = Helper.getCustomDataValue(this._oDefaultQualificationDialog.getAggregation("customData"), "UnitKey");
			var vEmpId = oEvent.getParameter("selectedItem").getKey();
			this.bindDefaultQualificationQuals(vUnitKey, vEmpId);
			this.bindDefaultQualificationTable(vEmpId);
		},

		bindDefaultQualificationQuals: function (vUnitKey, vEmpId, oEvent) {
			var oQualSelect = sap.ui.getCore().byId("ld_select_cdq_qualification");
			var oModel = this.getView().getModel();

			if (this.oCustomizing.PlanHideQKey) {
				var oTemplate = new sap.ui.core.Item({
					text: "{QualText}",
					key: "{QualId}"
				});
			} else {
				var oTemplate = new sap.ui.core.Item({
					text: "{QualId} - {QualText}",
					key: "{QualId}"
				});
			}

			// vDate = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "PlanDate")
			var oDatePicker = sap.ui.getCore().byId("ld_dp_cdq_begda");
			var oDate = oDatePicker.getDateValue();

			oDate.setUTCDate(oDate.getDate());
			// var vPlanBegda = this.getFormattedDate(oDate);
			var oDateFilter = new sap.ui.model.Filter("PlanDate", sap.ui.model.FilterOperator.EQ, oDate);
			var oEmpFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

			oQualSelect.setModel(oModel);

			oQualSelect.bindAggregation("items", {
				path: "/unitDefaultQualsSet",
				template: oTemplate,
				filters: [oUnitFilter, oEmpFilter, oDateFilter]
			});
		},

		bindDefaultQualificationTable: function (vEmpId) {
			var oDefQualTable = sap.ui.getCore().byId("ld_tbl_cdq_overview");
			var oEmpFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
			var oModel = this.getView().getModel();

			oDefQualTable.setBusyIndicatorDelay(0);
			oDefQualTable.setBusy(true);
			oDefQualTable.setModel(oModel);
			oDefQualTable.bindAggregation("rows", {
				path: "/defaultQualSet",
				filters: [oEmpFilter],
				events: {
					dataReceived: function () {
						oDefQualTable.setBusy(false);
					}
				}
			});
		},

		createDefaultQualification: function () {
			var oModel = this.getView().getModel();
			var oNewDefQual = {};
			var vEmpId = sap.ui.getCore().byId("ld_select_cdq_employee").getSelectedKey();
			var oBegdaSelect = sap.ui.getCore().byId("ld_dp_cdq_begda");
			var vQual = sap.ui.getCore().byId("ld_select_cdq_qualification").getSelectedKey();
			var oBegda = oBegdaSelect.getDateValue();
			var oToday = new Date();
			oToday.setHours(11);
			oToday.setMinutes(0);
			oToday.setSeconds(0);

			if (oBegda) {
				oBegda.setHours(12);
			} else {
				oBegdaSelect.setValueState(sap.ui.core.ValueState.Error);
				return;
			}

			if (!oBegda || oBegda < oToday) {
				oBegdaSelect.setValueState(sap.ui.core.ValueState.Error);
				return;
			} else {
				oBegdaSelect.setValueState(sap.ui.core.ValueState.None);
				oNewDefQual.Begda = oBegda;
				oNewDefQual.EmpId = vEmpId;
				oNewDefQual.QualId = vQual;
				oModel.create("/defaultQualSet", oNewDefQual, {
					success: function () {
						this.bindDefaultQualificationTable(sap.ui.getCore().byId("ld_select_cdq_employee").getSelectedItem().getBindingContext().getObject()
							.EmpId);
					}.bind(this)
				});
			}
		},

		onDefQualEntrySelect: function (oEvent) {
			var vSelectedIndex = oEvent.getSource().getSelectedIndex();
			if (vSelectedIndex == -1) {
				return;
			}
			var oEmpSelect = sap.ui.getCore().byId("ld_select_cdq_employee");
			var oBegdaSelect = sap.ui.getCore().byId("ld_dp_cdq_begda");
			var oQualSelect = sap.ui.getCore().byId("ld_select_cdq_qualification");

			var vBindingContext = oEvent.getSource().getContextByIndex(vSelectedIndex);

			oEmpSelect.setSelectedKey(oEvent.getSource().getModel().getProperty("EmpId", vBindingContext));
			oBegdaSelect.setDateValue(oEvent.getSource().getModel().getProperty("Begda", vBindingContext));
			oQualSelect.setSelectedKey(oEvent.getSource().getModel().getProperty("QualId", vBindingContext));

		},

		onCloseChangeDefaultQualificationDialog: function () {
			this._oDefaultQualificationDialog.close();
		},

		destroyDefaultQualificationDialog: function () {
			this._oDefaultQualificationDialog.destroy();
			this._oDefaultQualificationDialog = null;
		},

		setDateOfPickerToToday: function (oDatePicker) {
			var oToday = new Date();
			oDatePicker.setDateValue(oToday);
		},

		prepareCYCLEAVE: function (vUnitKey) {
			if (!this._oCyclicLeaveDialog) {
				this._oCyclicLeaveDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.CyclicLeave", this, {
					refreshAfterChange: true
				});
				this.getView().addDependent(this._oCyclicLeaveDialog);
				this._oCyclicLeaveDialog.open();
				this._oCyclicLeaveDialog.attachAfterClose(this.destroyCyclicLeaveDialog.bind(this));
				this._oCyclicLeaveDialog.setBusyIndicatorDelay(0);
				this._oCyclicLeaveDialog.setBusy(true);
			}
			this._oCyclicLeaveDialog.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));
			this.showCyclicLeavePanel();

			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");

			var oTemplate = new sap.ui.core.Item({
				text: "{= parseFloat(${EmpId}) } - {Name}",
				key: "{EmpId}"
			});

			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

			var oModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/MIND2/PEP_YEAR_SRV", {
				refreshAfterChange: false
			});

			oEmpSelect.setModel(oModel);
			oEmpSelect.bindItems({
				path: "/EmployeeSet",
				template: oTemplate,
				filters: [oUnitFilter],
				events: {
					dataReceived: function () {
						// if (oEmpSelect.getSelectableItems().length > 0) {
						if (oEmpSelect.getItems().length > 0) {
							// oEmpSelect.setSelectedIndex(0);
							oEmpSelect.setSelectedItem(oEmpSelect.getItems()[0]);
						}

						this.updateSubtyInCyclicLeave();

					}.bind(this)
				}
			});

		},

		// updateSubtyInCyclicLeave: function () {
		// 	var vUnitKey = Helper.getCustomDataValue(this._oCyclicLeaveDialog.getAggregation("customData"), "UnitKey");
		// 	var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
		// 	var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
		// 	var oModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/MIND2/PEP_YEAR_SRV", {
		// 		refreshAfterChange: true
		// 	});
		// 	var oSubtySelect = sap.ui.getCore().byId("cl_select_cyclic_event");
		// 	var oTemplateSubty = new sap.ui.core.Item({
		// 		text: "{SubtyText}",
		// 		key: "{Subty}",
		// 		customData: [{
		// 			Type: "sap.ui.core.CustomData",
		// 			key: "ganztaegig",
		// 			value: "{Ganztaegig}" // bind custom data
		// 		}, {
		// 			Type: "sap.ui.core.CustomData",
		// 			key: "Infty",
		// 			value: "{Infty}" // bind custom data
		// 		}, {
		// 			Type: "sap.ui.core.CustomData",
		// 			key: "ReasonMand",
		// 			value: "{ReasonMand}" // bind custom data
		// 		}]
		// 	});
		// 	var vEmpId = oEmpSelect.getSelectedKey();
		// 	var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
		// 	var oFeatureFilter = new sap.ui.model.Filter("FeatureKey", sap.ui.model.FilterOperator.EQ, "CYCLICLEAVE");
		// 	oSubtySelect.setModel(oModel);
		// 	oSubtySelect.bindItems({
		// 		path: "/SubtypSet",
		// 		template: oTemplateSubty,
		// 		filters: [oEmpIdFilter, oUnitFilter, oFeatureFilter],
		// 		events: {
		// 			dataReceived: function (oData) {
		// 				this.checkTimeVisibility(oData);
		// 			}.bind(this)
		// 		}
		// 	});
		// 	this.fillCyclicLeaveTable();
		// },

		updateSubtyInCyclicLeave: function () {
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vUnitKey = Helper.getCustomDataValue(this._oCyclicLeaveDialog.getAggregation("customData"), "UnitKey");
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oSubtySelect = sap.ui.getCore().byId("cl_select_cyclic_event");
			var oTemplateSubty = new sap.ui.core.Item({
				text: "{SubtyText}",
				key: "{Id}",
				customData: [{
					Type: "sap.ui.core.CustomData",
					key: "ganztaegig",
					value: "{Ganztaegig}" // bind custom data
				}, {
					Type: "sap.ui.core.CustomData",
					key: "Infty",
					value: "{Infty}" // bind custom data
				}, {
					Type: "sap.ui.core.CustomData",
					key: "ReasonMand",
					value: "{ReasonMand}" // bind custom data
				}, {
					Type: "sap.ui.core.CustomData",
					key: "TPROG",
					value: "{Tprog}" // bind custom data
				}, {
					Type: "sap.ui.core.CustomData",
					key: "Beguz",
					value: "{Beguz}" // bind custom data
				}, {
					Type: "sap.ui.core.CustomData",
					key: "Enduz",
					value: "{Enduz}" // bind custom data
				}, {
					Type: "sap.ui.core.CustomData",
					key: "TimeEditable",
					value: "{TimeEditable}" // bind custom data
				}, {
					Type: "sap.ui.core.CustomData",
					key: "Subty",
					value: "{Subty}" // bind custom data
				}, {
					Type: "sap.ui.core.CustomData",
					key: "CustomKey1",
					value: "{CustomKey1}" // bind custom data
				}]
			});
			var vEmpId = oEmpSelect.getSelectedKey();
			var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
			oSubtySelect.bindItems({
				path: "/cyclicTypesSet",
				template: oTemplateSubty,
				filters: [oEmpIdFilter, oUnitFilter],
				events: {
					dataReceived: function (oData) {
						if (oData.getSource().getContexts().length === 0) {
						 MessageBox.error(this.getResourceBundleText("no-cyclictypes"));
						 this.onCloseCyclicLeaveDialog();
						} else {
							var oItem = oData.getSource().getContexts()[0];
							oSubtySelect.setSelectedKey(oItem.getProperty("SubtyId"));
							this.checkTimeVisibility();
							this.fillCyclicLeaveTable();
						}
					}.bind(this)

				}
			});
		},

		fillCyclicLeaveTable: function () {
			var oModel = this.getView().getModel();
			var oCyclicLeaveTable = sap.ui.getCore().byId("ld_tbl_cyclicleaveoverview");
			var vEmpId = sap.ui.getCore().byId("ld_select_emp").getSelectedKey();
			var vUnitKey = Helper.getCustomDataValue(this._oCyclicLeaveDialog.getAggregation("customData"), "UnitKey");
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oEmpFilter = new sap.ui.model.Filter("Pernr", sap.ui.model.FilterOperator.EQ, vEmpId);
			var oTemplate = sap.ui.getCore().byId("cyclicLeaveTableTemplate");
			oCyclicLeaveTable.setModel(oModel);
			oCyclicLeaveTable.setBusyIndicatorDelay(0);
			oCyclicLeaveTable.setBusy(true);
			oCyclicLeaveTable.bindItems({
				path: "/cyclicLeaveSet",
				template: oTemplate,
				filters: [oEmpFilter, oUnitFilter],
				templateShareable: true,
				events: {
					dataReceived: function () {
						oCyclicLeaveTable.setBusy(false);
						this._oCyclicLeaveDialog.setBusy(false);
					}.bind(this)
				}
			});
		},

		showCyclicLeavePanel: function () {
			var oRBDaily = sap.ui.getCore().byId("rb_daily");
			var oRBWeekly = sap.ui.getCore().byId("rb_weekly");
			var oRBMonthly = sap.ui.getCore().byId("rb_monthly");

			var oPNLDaily = sap.ui.getCore().byId("pnl_daily");
			var oPNLWeekly = sap.ui.getCore().byId("pnl_weekly");
			var oPNLMonthly = sap.ui.getCore().byId("pnl_monthly");

			var vDaily = oRBDaily.getSelected();
			var vWeekly = oRBWeekly.getSelected();
			var vMonthly = oRBMonthly.getSelected();

			oPNLDaily.setVisible(vDaily);
			oPNLWeekly.setVisible(vWeekly);
			oPNLMonthly.setVisible(vMonthly);

			var today = new Date();
			var vTPBegin = sap.ui.getCore().byId("ld_dp_begda_leave");
			var vTPEnd = sap.ui.getCore().byId("ld_dp_endda_leave");

			vTPBegin.setMaxDate(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()));
			vTPEnd.setMaxDate(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()));
		},

		openTimeOverviewPopupWrapper: function (oEvent, vIUnitKey) {
			var vDate;
			var vEmpID;
			var vUnitKey;
			if (oEvent) {
				vDate = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "PlanDate");
				if (!vDate) {
					vDate = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "date");
				}
				vDate = typeof (vDate) === "string" ? parseInt(vDate) : vDate;
			} else {
				vDate = new Date();
			}
			if (oEvent) {
				vEmpID = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "EmpID");
				if (!vEmpID) {
					vEmpID = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "empId");
				}
			}
			if (oEvent) {
				vUnitKey = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "UnitKey");
				if (!vUnitKey) {
					vUnitKey = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "unityKey");
				}
			} else {
				vUnitKey = vIUnitKey;
			}
			if (vEmpID) {
				this.getView().getModel().callFunction("/CheckEmployeeLocked", {
					method: "GET",
					urlParameters: {
						"empId": vEmpID,
						"planBegda": this.getSelectedBegda(),
						"planEndda": this.getSelectedEndda()
					},
					success: function () {
						this.openTimeOverviewPopup(vDate, vUnitKey, vEmpID);
					}.bind(this),
					error: function (oError) {
						var aErrorMsg = JSON.parse(oError.responseText).error.innererror.errordetails;
						Helper.openConfirmDialog("{i18n>warning}", aErrorMsg[0].message, "{i18n>openanyway}", function () {
								this.openTimeOverviewPopup(vDate, vUnitKey, vEmpID);
							}.bind(this),
							null, this);
					}.bind(this)
				});
			} else {
				this.openTimeOverviewPopup(vDate, vUnitKey, vEmpID);
			}
		},

		openTimeOverviewPopup: function (iDate, iUnitKey, iEmpID) {
			if (this.isFeatureEnabled("TO_MAIN")) {
				TimesOverview.setController(this);
				TimesOverview.openTimeOverviewPopup(iDate, iUnitKey, iEmpID);
				return;
			}

			if (!this._oTimesOverviewDialog) {
				this._oTimesOverviewDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.TimesOverview", this, {
					refreshAfterChange: true
				});
				this._oTimesOverviewDialog.attachAfterClose(this.destroyTimeOverviewPopup.bind(this));
				this.getView().addDependent(this._oTimesOverviewDialog);
				var aPanels = this._oTimesOverviewDialog.getAggregation("content")[0].getSections();
				var sPanelId;
				var bPanelVisibility;
				for (var i = 0; i < aPanels.length; i++) {
					sPanelId = aPanels[i].getId();
					bPanelVisibility = Formatter.getPanelVisibility(sPanelId, this);
					aPanels[i].setVisible(bPanelVisibility);
				}
				if (this.isFeatureEnabled("TO_OVERT_F")) {
					sap.ui.getCore().byId("ld_inp_amount_overtime").setVisible(true);
				}
				if (this.isFeatureEnabled("TO_INTEGOT")) {
					sap.ui.getCore().byId("ld_inp_integratedOT").setVisible(true);
					sap.ui.getCore().byId("ld_lbl_integratedOT").setVisible(true);
				}
				if (this.isFeatureEnabled("OT_AMOUNT")) {
					sap.ui.getCore().byId("ld_inp_allowanceAmount").setVisible(true);
				}
				if (this.isFeatureEnabled("TO_VTART")) {
					sap.ui.getCore().byId("to_shift_select_subtype").setVisible(true);
					sap.ui.getCore().byId("chb_voluntary").setVisible(false);
				}
				if (this.isFeatureEnabled("TO_ABS_REA")) {
					sap.ui.getCore().byId("ld_select_subty_reason").setVisible(true);
					sap.ui.getCore().byId("ld_inp_subty_reason").setVisible(true);
					sap.ui.getCore().byId("columnAbsComment").setVisible(true);
					sap.ui.getCore().byId("columnAbsReason").setVisible(true);
				}
				if (this.isFeatureEnabled("COMMDATE")) {
					sap.ui.getCore().byId("lbl_comdat").setVisible(true);
					sap.ui.getCore().byId("ld_dp_comdat").setVisible(true);
					sap.ui.getCore().byId("ld_tp_comuzeit").setVisible(true);
				}
				if (this.isFeatureEnabled("TO_LOCKIND")) {
					sap.ui.getCore().byId("chb_sprps").setVisible(true);
				}
			}
			this._oTimesOverviewDialog.setBusy(true);

			var vDate = iDate;
			var vEmpID = iEmpID;
			var vUnitKey = iUnitKey;

			// this.getView().getModel().callFunction("/CheckEmployeeLocked", {
			// 	method: "GET",
			// 	urlParameters: {
			// 		"empId": vEmpID,
			// 		"planBegda": this.getSelectedBegda(),
			// 		"planEndda": this.getSelectedEndda()
			// 	},
			// 	success: function () {

			// 	},
			// 	error: function (oError) {
			// 		var aErrorMsg = JSON.parse(oError.responseText).error.innererror.errordetails;
			// 		Helper.openConfirmDialog("{i18n>warning}", aErrorMsg[0].message, "{i18n>openanyway}", null, this.closeTimeOverviewDialog
			// 			.bind(this), this);
			// 	}.bind(this)
			// });

			this._oTimesOverviewDialog.open();
			var oSpecialEntryFilter = new sap.ui.model.Filter("SpecialEntry", sap.ui.model.FilterOperator.EQ, false);

			var oModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/MIND2/PEP_YEAR_SRV", {
				refreshAfterChange: true
			});
			var oPlanBegda = this.getSelectedBegda();
			var oPlanEndda = this.getSelectedEndda();
			oPlanBegda.setUTCDate(oPlanBegda.getDate());
			oPlanEndda.setUTCDate(oPlanEndda.getDate());
			var vPlanBegda = this.getFormattedDate(oPlanBegda);
			var vPlanEndda = this.getFormattedDate(oPlanEndda);
			this._oTimesOverviewDialog.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));
			var oPlanBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, vPlanBegda);
			var oPlanEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, vPlanEndda);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			oModel.read("/EmployeeSet", {
				success: function (oData) {
					var oSelectEmp = sap.ui.getCore().byId("ld_select_emp");
					var aData = oData.results;
					for (var i = 0; i < aData.length; i++) {
						var oTemplate = new sap.ui.core.Item({
							text: parseInt(aData[i].EmpId, 10) + " - " + aData[i].Name,
							key: aData[i].EmpId
						});
						var oCustomData = new sap.ui.core.CustomData({
							key: "UnitKey",
							// writeToDom: true,
							value: aData[i].UnitKey
						});
						oTemplate.addCustomData(oCustomData);

						oSelectEmp.addItem(oTemplate);

						if (aData[i].EmpId == vEmpID) {
							//oSelectEmp.setSelectedItem(vEmpID);
							oSelectEmp.setSelectedKey(vEmpID);
							//oSelectEmp.setSelectedIndex(vEmpID);
							this.onEmployeeChangeTimeOverview();
							sap.ui.getCore().byId("ld_dp_currentDate").focus();
							this.getAllowanceSet();
							this.bindTimeEventTable();
							this.bindRptimeMsgTimesOverview();
						}
					}
					this._oTimesOverviewDialog.setBusy(false);
				}.bind(this),
				error: function (oError) {
					this._oTimesOverviewDialog.setBusy(false);
				},
				filters: [oSpecialEntryFilter, oUnitFilter, oPlanBegdaFilter, oPlanEnddaFilter]
			});

			vDate = new Date(vDate);
			vDate.setHours(12);
			var oCurrentDate = sap.ui.getCore().byId("ld_dp_currentDate");
			oCurrentDate.setDateValue(vDate);
			var oCalendarWeek = sap.ui.getCore().byId("inp_calendarWeek");
			var aWeekday = new Array(7);
			aWeekday[0] = this.getResourceBundleText("sunday");
			aWeekday[1] = this.getResourceBundleText("monday");
			aWeekday[2] = this.getResourceBundleText("tuesday");
			aWeekday[3] = this.getResourceBundleText("wednesday");
			aWeekday[4] = this.getResourceBundleText("thursday");
			aWeekday[5] = this.getResourceBundleText("friday");
			aWeekday[6] = this.getResourceBundleText("saturday");

			var vWeekday = aWeekday[vDate.getDay()];

			var copiedDate = new Date(vDate.getTime());
			copiedDate.setUTCDate(copiedDate.getUTCDate() + 4 - (copiedDate.getUTCDay() || 7));
			var yearStart = new Date(Date.UTC(vDate.getUTCFullYear(), 0, 1));
			var vCalendarWeek = Math.ceil((((copiedDate - yearStart) / 86400000)) / 7);

			var vCalendarWeekValue = "KW " + vCalendarWeek + " - " + vWeekday;
			oCalendarWeek.setValue(vCalendarWeekValue);
			var oCicoDate = sap.ui.getCore().byId("ld_dp_date");
			if (oCicoDate) {
				oCicoDate.setDateValue(vDate);
			}
			var oLeaveBegda = sap.ui.getCore().byId("ld_dp_begda_leave");
			if (oLeaveBegda) {
				oLeaveBegda.setDateValue(vDate);
			}
			var oLeaveEndda = sap.ui.getCore().byId("ld_dp_endda_leave");
			if (oLeaveEndda) {
				oLeaveEndda.setDateValue(vDate);
			}
			var oOvertimeBegda = sap.ui.getCore().byId("ld_dp_begda_overtime");
			if (oOvertimeBegda) {
				oOvertimeBegda.setDateValue(vDate);
			}
			var oOvertimeEndda = sap.ui.getCore().byId("ld_dp_endda_overtime");
			if (oOvertimeEndda) {
				oOvertimeEndda.setDateValue(vDate);
			}
			this.getTimeEventSet(vUnitKey);
		},

		destroyTimeOverviewPopup: function () {
			this._oTimesOverviewDialog.destroy();
			this._oTimesOverviewDialog = null;
			this.ShiftDirty = false;
			this.AbsDirty = false;
			this.OvertimeDirty = false;
			this.CicoDirty = false;
			this.AllowDirty = false;
		},

		destroyCyclicLeaveDialog: function () {
			this._oCyclicLeaveDialog.destroy();
			this._oCyclicLeaveDialog = null;
		},

		destroyEmployeeSortDialog: function () {
			this._oEmployeeSortDialog.destroy();
			this._oEmployeeSortDialog = null;
		},

		onCloseTimeOverviewDialogViaButton: function (oEvent) {
			var vDirty = this.onCloseTimeOverviewDialog(oEvent);
			if (vDirty) {
				Helper.openConfirmDialog("{i18n>areyousure}", vDirty, "{i18n>discard}", this.closeTimeOverviewDialog.bind(this), null, this);
			} else {
				this._oTimesOverviewDialog.close();
			}
		},

		closeTimeOverviewDialog: function () {
			this._oTimesOverviewDialog.close();
		},

		closeShiftSubstitutionDialog: function () {
			this._oShiftSubstitutionDialog.close();
		},

		destroyShiftSubstitutionDialog: function () {
			this._oShiftSubstitutionDialog.destroy();
			this._oShiftSubstitutionDialog = null;
		},

		onCloseCyclicLeaveDialog: function () {
			this._oCyclicLeaveDialog.close();
		},

		onCloseTimeOverviewDialog: function () {
			var vErrorMsg;
			if (this.ShiftDirty || this.AbsDirty || this.OvertimeDirty || this.CicoDirty || this.AllowDirty) {
				var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
				if (this.ShiftDirty) {
					vErrorMsg = oResourceBundle.getText("newchangeshift");
				}
				if (this.AbsDirty) {
					vErrorMsg = oResourceBundle.getText("newchangesleave");
				}
				if (this.OvertimeDirty) {
					vErrorMsg = oResourceBundle.getText("newchangesovertime");
				}
				if (this.CicoDirty) {
					vErrorMsg = oResourceBundle.getText("newchangescico");
				}
				if (this.AllowDirty) {
					vErrorMsg = oResourceBundle.getText("newchangesallowance");
				}
			}
			return vErrorMsg;
		},

		// CEPOI_EXT 24.02.2021 >>>
		onTimesOverviewOneDayBack: function () {
			var vNewDate = new Date();
			var oDatePicker = sap.ui.getCore().byId("ld_dp_currentDate");
			var vDateOffset = 24 * 60 * 60 * 1000;
			var vDate = oDatePicker.getDateValue();
			vNewDate.setTime(vDate.getTime() - vDateOffset);
			vNewDate.setHours(12);
			oDatePicker.setDateValue(vNewDate);
			oDatePicker.setValueState(sap.ui.core.ValueState.None);
			oDatePicker.fireChange();
			sap.ui.getCore().byId("ld_dp_date").setDateValue(vNewDate);
			sap.ui.getCore().byId("ld_dp_date").setValueState(sap.ui.core.ValueState.None);
			this.clearCicoInput(); // clear CiCo
			sap.ui.getCore().byId("ld_dp_begda_leave").setDateValue(vNewDate);
			sap.ui.getCore().byId("ld_dp_endda_leave").setDateValue(vNewDate);
			sap.ui.getCore().byId("ld_dp_begda_leave").setValueState(sap.ui.core.ValueState.None);
			sap.ui.getCore().byId("ld_dp_endda_leave").setValueState(sap.ui.core.ValueState.None);
			sap.ui.getCore().byId("ld_dp_begda_overtime").setDateValue(vNewDate);
			sap.ui.getCore().byId("ld_dp_endda_overtime").setDateValue(vNewDate);
			sap.ui.getCore().byId("ld_dp_begda_overtime").setValueState(sap.ui.core.ValueState.None);
			sap.ui.getCore().byId("ld_dp_endda_overtime").setValueState(sap.ui.core.ValueState.None);
			if (sap.ui.getCore().byId("ld_select_subty_reason").getVisible()) {
				sap.ui.getCore().byId("ld_select_subty_reason").setSelectedKey("");
				sap.ui.getCore().byId("ld_inp_subty_reason").setValue("");
			}
			this.getEmpShift();
			this.bindTimeEventTable();
			this.fillLeaveTable();
			this.fillOvertimeTable();
			this.getAllowanceSet();
			this.getTimeTransfer();
		},
		// <<<	

		// CEPOI_EXT 24.02.2021 >>>
		onTimesOverviewOneDayFor: function () {
			var vNewDate = new Date();
			var oDatePicker = sap.ui.getCore().byId("ld_dp_currentDate");
			var vDate = oDatePicker.getDateValue();
			var vDateOffset = 24 * 60 * 60 * 1000;
			vNewDate.setTime(vDate.getTime() + vDateOffset);
			vNewDate.setHours(12);
			oDatePicker.setDateValue(vNewDate);
			oDatePicker.setValueState(sap.ui.core.ValueState.None);
			oDatePicker.fireChange();
			sap.ui.getCore().byId("ld_dp_date").setDateValue(vNewDate);
			sap.ui.getCore().byId("ld_dp_date").setValueState(sap.ui.core.ValueState.None);
			this.clearCicoInput(); // clear CiCo
			sap.ui.getCore().byId("ld_dp_begda_leave").setDateValue(vNewDate);
			sap.ui.getCore().byId("ld_dp_endda_leave").setDateValue(vNewDate);
			sap.ui.getCore().byId("ld_dp_begda_leave").setValueState(sap.ui.core.ValueState.None);
			sap.ui.getCore().byId("ld_dp_endda_leave").setValueState(sap.ui.core.ValueState.None);
			sap.ui.getCore().byId("ld_dp_begda_overtime").setDateValue(vNewDate);
			sap.ui.getCore().byId("ld_dp_endda_overtime").setDateValue(vNewDate);
			sap.ui.getCore().byId("ld_dp_begda_overtime").setValueState(sap.ui.core.ValueState.None);
			sap.ui.getCore().byId("ld_dp_endda_overtime").setValueState(sap.ui.core.ValueState.None);
			if (sap.ui.getCore().byId("ld_select_subty_reason").getVisible()) {
				sap.ui.getCore().byId("ld_select_subty_reason").setSelectedKey("");
				sap.ui.getCore().byId("ld_inp_subty_reason").setValue("");
			}
			this.getEmpShift();
			this.bindTimeEventTable();
			this.fillLeaveTable();
			this.fillOvertimeTable();
			this.getAllowanceSet();
			this.getTimeTransfer();
		},

		onChangeTimeOverviewDate: function () {
			var oDatePicker = sap.ui.getCore().byId("ld_dp_currentDate");
			var vDate = oDatePicker.getDateValue();
			vDate.setHours(12);
			oDatePicker.setDateValue(vDate);
			oDatePicker.setValueState(sap.ui.core.ValueState.None);

			var oCalendarWeek = sap.ui.getCore().byId("inp_calendarWeek");
			var aWeekday = new Array(7);
			aWeekday[0] = this.getResourceBundleText("sunday");
			aWeekday[1] = this.getResourceBundleText("monday");
			aWeekday[2] = this.getResourceBundleText("tuesday");
			aWeekday[3] = this.getResourceBundleText("wednesday");
			aWeekday[4] = this.getResourceBundleText("thursday");
			aWeekday[5] = this.getResourceBundleText("friday");
			aWeekday[6] = this.getResourceBundleText("saturday");

			var vWeekday = aWeekday[vDate.getDay()];

			var copiedDate = new Date(vDate.getTime());
			copiedDate.setUTCDate(copiedDate.getUTCDate() + 4 - (copiedDate.getUTCDay() || 7));
			var yearStart = new Date(Date.UTC(copiedDate.getUTCFullYear(), 0, 1));
			var vCalendarWeek = Math.ceil((((copiedDate - yearStart) / 86400000)) / 7);

			var vCalendarWeekValue = "KW " + vCalendarWeek + " - " + vWeekday;
			oCalendarWeek.setValue(vCalendarWeekValue);

			sap.ui.getCore().byId("ld_dp_date").setDateValue(vDate);
			sap.ui.getCore().byId("ld_dp_date").setValueState(sap.ui.core.ValueState.None);
			this.clearCicoInput(); // clear CiCo
			sap.ui.getCore().byId("ld_dp_begda_leave").setDateValue(vDate);
			sap.ui.getCore().byId("ld_dp_endda_leave").setDateValue(vDate);
			sap.ui.getCore().byId("ld_dp_begda_leave").setValueState(sap.ui.core.ValueState.None);
			sap.ui.getCore().byId("ld_dp_endda_leave").setValueState(sap.ui.core.ValueState.None);
			sap.ui.getCore().byId("ld_dp_begda_overtime").setDateValue(vDate);
			sap.ui.getCore().byId("ld_dp_endda_overtime").setDateValue(vDate);
			sap.ui.getCore().byId("ld_dp_begda_overtime").setValueState(sap.ui.core.ValueState.None);
			sap.ui.getCore().byId("ld_dp_endda_overtime").setValueState(sap.ui.core.ValueState.None);
			if (sap.ui.getCore().byId("ld_select_subty_reason").getVisible()) {
				sap.ui.getCore().byId("ld_select_subty_reason").setSelectedKey("");
				sap.ui.getCore().byId("ld_inp_subty_reason").setValue("");
			}
			this.getEmpShift();
			this.bindTimeEventTable();
			this.fillLeaveTable();
			this.fillOvertimeTable();
			this.getAllowanceSet();
		},
		// <<<

		onTimesOverviewShiftVoluntary: function () {
			this.ShiftDirty = true;
		},

		getAllowanceSet: function () {
			var oTable = sap.ui.getCore().byId("ld_tbl_allowanceOverview");
			var oModel = this.getView().getModel();

			var oPanel = sap.ui.getCore().byId('pnl_allowance');
			var oAllowSelect = sap.ui.getCore().byId("ld_select_Allowance");
			var oPayGroupSelect = sap.ui.getCore().byId('ld_inp_allowancePayGroup');
			var oExtRegSelect = sap.ui.getCore().byId('ld_inp_allowanceExtReg');
			var oDate = sap.ui.getCore().byId("ld_dp_date");
			var vDateValue = oDate.getDateValue();
			if (vDateValue !== null) {
				vDateValue.setHours(12);
			}
			var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "yyyyMMdd"
			});
			var vDateFormatted = oDateFormat.format(vDateValue);
			var oDateFilter = new sap.ui.model.Filter("ZDate", sap.ui.model.FilterOperator.EQ, vDateFormatted);
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oSelectedItem = oEmpSelect.getSelectedItem();
			var vEmpId = oSelectedItem.getKey();
			var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);

			if (!oPanel.getModel("AllowanceModel")) {
				var oSysModel = new sap.ui.model.json.JSONModel();
				oPanel.setModel(oSysModel, "AllowanceModel");
			}

			var aCustomData = oSelectedItem.getCustomData();
			var vUnitKey = Helper.getCustomDataValue(aCustomData, "UnitKey");
			var oUnitKeyFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

			oTable.setBusyIndicatorDelay(0);
			oTable.setBusy(true);
			oTable.bindRows({
				path: "/allowanceSet",
				filters: [oEmpIdFilter, oDateFilter],
				events: {
					dataReceived: function () {
						oTable.setBusy(false);
					}
				}
			});

			var oTemplateShifts = new sap.ui.core.Item({
				text: "{AllowText}",
				key: "{Zulage}"
			});

			oAllowSelect.setModel(oModel);
			oAllowSelect.bindAggregation("items", {
				path: "/availAllowShiftSet",
				template: oTemplateShifts,
				filters: [oEmpIdFilter, oUnitKeyFilter],
				events: {
					dataReceived: function () {
						setTimeout(function () {
							oPanel.getModel("AllowanceModel").setProperty("/Allowance", oAllowSelect.getSelectedItem().getBindingContext().getObject());
						});
					}
				}
			});

			var oValueHelpTemplate = new sap.ui.core.Item({
				text: "{ItemKey}",
				key: "{ItemValue}"
			});

			oPayGroupSelect.bindAggregation("items", {
				path: "/valueHelpAllowSet",
				template: oValueHelpTemplate,
				filters: [oUnitKeyFilter, new sap.ui.model.Filter("FieldKey", "EQ", "TRFGR")]
			});

			oExtRegSelect.bindAggregation("items", {
				path: "/valueHelpAllowSet",
				template: oValueHelpTemplate,
				filters: [oUnitKeyFilter, new sap.ui.model.Filter("FieldKey", "EQ", "EXBEL")]
			});
		},

		onAddAllowance: function () {
			var oModel = this.getView().getModel();
			var oInpHours = sap.ui.getCore().byId("ld_inp_allowanceHours");
			var oInpAmount = sap.ui.getCore().byId("ld_inp_allowanceAmount");
			var oSelAllowance = sap.ui.getCore().byId("ld_select_Allowance");
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oDate = sap.ui.getCore().byId("ld_dp_date");
			var oPayGroup = sap.ui.getCore().byId('ld_inp_allowancePayGroup');
			var oExtReg = sap.ui.getCore().byId('ld_inp_allowanceExtReg');
			var oTimeUnit = sap.ui.getCore().byId('ld_inp_allowanceTimeUnit');
			var oComment = sap.ui.getCore().byId('ld_inp_allowanceReason');

			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var oObject = {};

			var vToggleMode = "create";
			var vHours = oInpHours.getValue();
			var vAmount = oInpAmount.getValue();
			var vAllowance = oSelAllowance.getSelectedItem().getKey();
			var vEmpId = oEmpSelect.getSelectedItem().getKey();
			var vDate = oDate.getDateValue();
			var vPayGroup = oPayGroup.getSelectedKey();
			var vExtReg = oExtReg.getSelectedKey();
			var vTimeUnit = oTimeUnit.getValue();
			var vComment = oComment.getValue();

			vDate = this.getFormattedDate(vDate);

			if (!vHours && !vAmount) {
				oInpHours.setValueState(sap.ui.core.ValueState.Error);
				oInpAmount.setValueState(sap.ui.core.ValueState.Error);

			} else {
				oInpHours.setValueState(sap.ui.core.ValueState.None);
				oInpAmount.setValueState(sap.ui.core.ValueState.None);

				oObject.EmpId = vEmpId;
				oObject.ZDate = vDate;
				oObject.Zulage = vAllowance;
				oObject.ZHours = parseFloat(vHours).toFixed(7);
				oObject.ZAmount = parseInt(vAmount);
				oObject.ZZeinh = vTimeUnit;
				oObject.ZTrfgr = vPayGroup;
				oObject.ZExbel = vExtReg;
				oObject.ZComment = vComment;

				oModel.create("/allowanceSet", oObject, {
					success: function () {
						var vCreated = oResourceBundle.getText("allowancecreated");
						MessageToast.show(vCreated);
						this.getAllowanceSet();
					}.bind(this),
					error: function (oError) {
						this.createError(oError);
					}.bind(this)
				});

				this.toggleAllowanceButtons(vToggleMode);

				this.AllowDirty = false;
			}
		},

		onAllowanceEntrySelect: function (oEvent) {
			if (oEvent.getSource().getSelectedIndex() == -1) {
				return;
			}
			var oShiftSelect = sap.ui.getCore().byId("ld_select_Allowance");
			var oInpHours = sap.ui.getCore().byId("ld_inp_allowanceHours");
			var oInpAmount = sap.ui.getCore().byId("ld_inp_allowanceAmount");

			var oPayGroup = sap.ui.getCore().byId('ld_inp_allowancePayGroup');
			var oExtReg = sap.ui.getCore().byId('ld_inp_allowanceExtReg');
			var oTimeUnit = sap.ui.getCore().byId('ld_inp_allowanceTimeUnit');
			var oComment = sap.ui.getCore().byId('ld_inp_allowanceReason');

			var vToggleMode = "edit";

			var vBindingContext = oEvent.getSource().getContextByIndex(oEvent.getSource().getSelectedIndex());

			oShiftSelect.setSelectedKey(oEvent.getSource().getModel().getProperty("Zulage", vBindingContext));
			oInpHours.setValue(oEvent.getSource().getModel().getProperty("ZHours", vBindingContext));
			oInpAmount.setValue(oEvent.getSource().getModel().getProperty("ZAmount", vBindingContext));
			oTimeUnit.setValue(oEvent.getSource().getModel().getProperty("ZZeinh", vBindingContext));
			oPayGroup.setSelectedKey(oEvent.getSource().getModel().getProperty("ZTrfgr", vBindingContext));
			oExtReg.setSelectedKey(oEvent.getSource().getModel().getProperty("ZExbel", vBindingContext));
			oComment.setSelectedKey(oEvent.getSource().getModel().getProperty("ZComment", vBindingContext));

			this.toggleAllowanceButtons(vToggleMode);
		},

		onUpdateAllowance: function () {
			var oModel = this.getView().getModel();
			var oInpHours = sap.ui.getCore().byId("ld_inp_allowanceHours");
			var oInpAmount = sap.ui.getCore().byId("ld_inp_allowanceAmount");
			var oSelAllowance = sap.ui.getCore().byId("ld_select_Allowance");
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oDate = sap.ui.getCore().byId("ld_dp_date");
			var oTable = sap.ui.getCore().byId("ld_tbl_allowanceOverview");
			var oPayGroup = sap.ui.getCore().byId('ld_inp_allowancePayGroup');
			var oExtReg = sap.ui.getCore().byId('ld_inp_allowanceExtReg');
			var oTimeUnit = sap.ui.getCore().byId('ld_inp_allowanceTimeUnit');
			var oComment = sap.ui.getCore().byId('ld_inp_allowanceReason');

			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var oObject = {};

			var vToggleMode = "create";
			var vHours = oInpHours.getValue();
			var vAmount = oInpAmount.getValue();
			var vAllowance = oSelAllowance.getSelectedItem().getKey();
			var vEmpId = oEmpSelect.getSelectedItem().getKey();
			var vDate = oDate.getDateValue();
			var oContext = oTable.getContextByIndex(oTable.getSelectedIndex());
			var vPayGroup = oPayGroup.getSelectedKey();
			var vExtReg = oExtReg.getSelectedKey();
			var vTimeUnit = oTimeUnit.getValue();
			var vComment = oComment.getValue();

			vDate = this.getFormattedDate(vDate);

			if (!vHours && !vAmount) {
				oInpHours.setValueState(sap.ui.core.ValueState.Error);
				oInpAmount.setValueState(sap.ui.core.ValueState.Error);

			} else {
				oInpHours.setValueState(sap.ui.core.ValueState.None);
				oInpAmount.setValueState(sap.ui.core.ValueState.None);

				oObject.EmpId = vEmpId;
				oObject.ZDate = vDate;
				oObject.Zulage = vAllowance;
				oObject.ZHours = parseFloat(vHours).toFixed(7);
				oObject.ZAmount = parseInt(vAmount);
				oObject.Seqnr = oContext.getObject().Seqnr;
				oObject.ZZeinh = vTimeUnit;
				oObject.ZTrfgr = vPayGroup;
				oObject.ZExbel = vExtReg;
				oObject.ZComment = vComment;

				oModel.update(oContext.sPath, oObject, {
					refreshAfterChange: true,
					success: function () {
						var vModified = oResourceBundle.getText("allowancemodified");
						MessageToast.show(vModified);
						this.getAllowanceSet();
					}.bind(this),
					error: this.createError.bind(this)
				});

				this.toggleAllowanceButtons(vToggleMode);

				this.AllowDirty = false;
			}
		},

		onDeleteAllowance: function () {
			var oModel = this.getView().getModel();
			var oTable = sap.ui.getCore().byId("ld_tbl_allowanceOverview");
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vToggleMode = "create";
			var oContext = oTable.getContextByIndex(oTable.getSelectedIndex());
			oModel.remove(oContext.sPath, {
				success: function () {
					var vDeleted = oResourceBundle.getText("allowancedeleted");
					MessageToast.show(vDeleted);
					this.getAllowanceSet();
				}.bind(this),
				error: this.createError.bind(this)
			});

			this.toggleAllowanceButtons(vToggleMode);

			this.AllowDirty = false;
		},

		onCancelAllowance: function () {
			var vToggleMode = "create";

			this.toggleAllowanceButtons(vToggleMode);
		},

		toggleAllowanceButtons: function (vMode) {
			var oBtnSave = sap.ui.getCore().byId("btn_allowanceAdd");
			var oBtnUpdate = sap.ui.getCore().byId("btn_allowanceUpdate");
			var oBtnCancel = sap.ui.getCore().byId("btn_allowanceCancel");
			var oBtnDelete = sap.ui.getCore().byId("btn_allowanceDel");

			var oShiftSelect = sap.ui.getCore().byId("ld_select_Allowance");
			var oInpHours = sap.ui.getCore().byId("ld_inp_allowanceHours");
			var oInpAmount = sap.ui.getCore().byId("ld_inp_allowanceAmount");
			var oTimeUnit = sap.ui.getCore().byId('ld_inp_allowanceTimeUnit');
			var oComment = sap.ui.getCore().byId('ld_inp_allowanceReason');

			var oTableAllowance = sap.ui.getCore().byId("ld_tbl_allowanceOverview");

			if (vMode == "edit") {
				oBtnSave.setEnabled(false);
				oBtnUpdate.setEnabled(true);
				oBtnCancel.setEnabled(true);
				oBtnDelete.setEnabled(true);
			} else if (vMode == "create") {
				oBtnSave.setEnabled(true);
				oBtnUpdate.setEnabled(false);
				oBtnCancel.setEnabled(false);
				oBtnDelete.setEnabled(false);

				oShiftSelect.setSelectedKey(0);
				oInpHours.setValue();
				oInpAmount.setValue();
				oTimeUnit.setValue();
				oComment.setValue();

				oInpHours.setEnabled(true);
				oInpAmount.setEnabled(true);

				oTableAllowance.setSelectionMode("Single");
			}
		},

		toggleTimeTransferButtons: function (vMode) {
			var oDate = new Date();

			var oBtnSave = sap.ui.getCore().byId("btn_timeTransfer_Save");
			var oBtnUpdate = sap.ui.getCore().byId("btn_timetransferEdit");
			var oBtnCancel = sap.ui.getCore().byId("btn_timetransferCancel");
			var oBtnDelete = sap.ui.getCore().byId("btn_timetransferDel");

			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_timetransfer");
			var oInpAmount = sap.ui.getCore().byId("ld_inp_amount_timetransfer");
			var oDpBegda = sap.ui.getCore().byId("ld_dp_begda_timetransfer");
			var oDpEndda = sap.ui.getCore().byId("ld_dp_endda_timetransfer");

			var oTable = sap.ui.getCore().byId("ld_tbl_timetransferoverview");

			if (vMode == "edit") {
				oBtnSave.setEnabled(false);
				oBtnUpdate.setEnabled(true);
				oBtnCancel.setEnabled(true);
				oBtnDelete.setEnabled(true);

				oSubtySelect.setEnabled(false);
				oDpBegda.setEnabled(false);
				oDpEndda.setEnabled(false);

			} else if (vMode == "create") {
				oBtnSave.setEnabled(true);
				oBtnUpdate.setEnabled(false);
				oBtnCancel.setEnabled(false);
				oBtnDelete.setEnabled(false);

				oSubtySelect.setEnabled(true);

				oSubtySelect.setSelectedKey(0);
				oInpAmount.setValue();

				oInpAmount.setEnabled(true);
				oDpBegda.setEnabled(true);
				oDpEndda.setEnabled(true);

				oDpBegda.setDateValue(oDate);
				oDpEndda.setDateValue(oDate);

				oTable.setSelectionMode("Single");
			}
		},

		bindEmployeeSet: function (oModel, vUnitKey) {
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oSelect = sap.ui.getCore().byId("ld_select_emp");
			var oSpecialEntryFilter = new sap.ui.model.Filter("SpecialEntry", sap.ui.model.FilterOperator.EQ, false);
			var oPlanBegda = this.getSelectedBegda();
			var oPlanEndda = this.getSelectedEndda();
			oPlanBegda.setUTCDate(oPlanBegda.getDate());
			oPlanEndda.setUTCDate(oPlanEndda.getDate());
			var vPlanBegda = this.getFormattedDate(oPlanBegda);
			var vPlanEndda = this.getFormattedDate(oPlanEndda);
			var oPlanBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, vPlanBegda);
			var oPlanEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, vPlanEndda);

			oModel.read("/EmployeeSet", {
				success: function (oData, oResponse) {
					var aData = oData.results;
					for (var i = 0; i < aData.length; i++) {
						var oTemplate = new sap.ui.core.Item({
							text: aData[i].Name,
							key: aData[i].EmpId
						});
						var oCustomData = new sap.ui.core.CustomData({
							key: "UnitKey",
							// writeToDom: true,
							value: aData[i].UnitKey
						});
						oTemplate.addCustomData(oCustomData);

						oSelect.addItem(oTemplate);
						if (i == 0) {
							oSelect.setSelectedItem(oTemplate);
						}
					}
					this.bindTimeEventTable();
				}.bind(this),
				filters: [oSpecialEntryFilter, oUnitFilter, oPlanBegdaFilter, oPlanEnddaFilter]
			});
		},

		onCicoDateChange: function (oEvent) {
			var oElementID = oEvent.getParameter("id");
			sap.ui.getCore().byId(oElementID).setValueState(sap.ui.core.ValueState.None);
			this.bindTimeEventTable();
		},

		onCicoTimeChange: function (oEvent) {
			var oElementID = oEvent.getParameter("id");
			sap.ui.getCore().byId(oElementID).setValueState(sap.ui.core.ValueState.None);
			this.CicoDirty = true;
		},

		// CEPOI_EXT 24.02.2021 >>>
		bindTimeEventTable: function () {
			var oTable = sap.ui.getCore().byId("ld_tbl_cicooverview");
			var oDate = sap.ui.getCore().byId("ld_dp_date");
			var vDateValue = oDate.getDateValue();
			if (vDateValue !== null) {
				vDateValue.setHours(12);
			}
			var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				// pattern: "yyyyMMdd"
				pattern: "yyyy-MM-ddTHH:mm:ss"
			});
			var vDateFormatted = oDateFormat.format(vDateValue);
			var oDateFilter = new sap.ui.model.Filter("Ldate", sap.ui.model.FilterOperator.EQ, vDateFormatted);
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oSelectedItem = oEmpSelect.getSelectedItem();
			var vEmpId = oSelectedItem.getKey();
			var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
			var vUnitKey;
			if (this._oCicoDialog) {
				vUnitKey = Helper.getCustomDataValue(this._oCicoDialog.getAggregation("customData"), "UnitKey");
			} else {
				vUnitKey = Helper.getCustomDataValue(this._oTimesOverviewDialog.getAggregation("customData"), "UnitKey");
			}
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

			oTable.setBusyIndicatorDelay(0);
			oTable.setBusy(true);
			oTable.bindRows({
				path: "/timeEventNSet",
				filters: [oEmpIdFilter, oDateFilter, oUnitFilter],
				events: {
					dataReceived: function () {
						oTable.setBusy(false);
					}.bind(this)
				}
			});
		},
		// <<<

		onOpenChangeUnit: function (oEvent) {
			if (!this._oChangeUnitDialog) {
				this._oChangeUnitDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.ChangeUnit", this, {
					refreshAfterChange: true
				});
				this._oChangeUnitDialog.attachAfterClose(this.destroyChangeUnitDialog.bind(this));
			}
			this.getView().addDependent(this._oChangeUnitDialog);
			var vEmpID = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "EmpID");
			var vUnitKey = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "UnitKey");
			var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpID);
			var oSelectEmp = sap.ui.getCore().byId("ld_select_cu_employee");
			var oSelectUnit = sap.ui.getCore().byId("ld_select_cu_unit");

			this._oChangeUnitDialog.open();
			this._oChangeUnitDialog.setBusyIndicatorDelay(0);
			this._oChangeUnitDialog.setBusy(true);
			var oPlanBegda = this.getSelectedBegda();
			var oPlanEndda = this.getSelectedEndda();
			oPlanBegda.setUTCDate(oPlanBegda.getDate());
			oPlanEndda.setUTCDate(oPlanEndda.getDate());
			var vPlanBegda = this.getFormattedDate(oPlanBegda);
			var vPlanEndda = this.getFormattedDate(oPlanEndda);
			var oPlanBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, vPlanBegda);
			var oPlanEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, vPlanEndda);
			var oModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/MIND2/PEP_YEAR_SRV", {
				refreshAfterChange: true
			});
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			oModel.read("/EmployeeSet", {
				success: function (oData, oResponse) {
					var aData = oData.results;
					for (var i = 0; i < aData.length; i++) {
						var oTemplate = new sap.ui.core.Item({
							text: aData[i].Name,
							key: aData[i].EmpId
						});
						var oCustomData = new sap.ui.core.CustomData({
							key: "UnitKey",
							// writeToDom: true,
							value: aData[i].UnitKey
						});
						oTemplate.addCustomData(oCustomData);

						oSelectEmp.addItem(oTemplate);

						if (aData[i].EmpId == vEmpID) {
							oSelectEmp.setSelectedItem(vEmpID);
							oSelectEmp.setSelectedIndex(vEmpID);
						}
					}
					this.getCuTableData();
					this._oChangeUnitDialog.setBusy(false);
				}.bind(this),
				filters: [oUnitFilter, oPlanBegdaFilter, oPlanEnddaFilter]
			});
			oModel.read("/UnitSet", {
				success: function (oData, oResponse) {
					var aData = oData.results;
					for (var i = 0; i < aData.length; i++) {
						var oTemplate = new sap.ui.core.Item({
							text: aData[i].UnitText,
							key: aData[i].UnitKey
						});

						oSelectUnit.addItem(oTemplate);
					}
				}.bind(this)
			});
		},

		getCuTableData: function () {
			var oModel = this.getView().getModel();
			var oTable = sap.ui.getCore().byId("ld_tbl_cu_overview");
			var vEmpId = sap.ui.getCore().byId("ld_select_cu_employee").getSelectedItem().getKey();
			var oEmpFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
			if (vEmpId !== null) {
				oTable.setModel(oModel);
				oTable.bindAggregation("rows", {
					path: "/mainUnitSet",
					filters: [oEmpFilter],
					events: {
						dataRequested: function () {
							oTable.setBusy(true);
						},
						dataReceived: function () {
							oTable.setBusy(false);
						}
					}
				});
			}
		},

		onCuEmployeeChange: function (oEvent) {
			this.getCuTableData();
		},

		onSaveUnitChange: function (oEvent) {
			this._oChangeUnitDialog.setBusy(true);
			var oModel = this.getView().getModel();
			var oEmpSelect = sap.ui.getCore().byId("ld_select_cu_employee");
			var oBegda = sap.ui.getCore().byId("ld_tp_cu_begda");
			var oUnitSelect = sap.ui.getCore().byId("ld_select_cu_unit");
			var oRecord = {};
			var vEmpId = oEmpSelect.getSelectedKey();
			var vUnitKey = oUnitSelect.getSelectedKey();
			var vBegda = oBegda.getDateValue();
			var vFormattedDate = this.getFormattedDate(vBegda);
			var vCurrDate = new Date();
			vCurrDate.setHours(0, 0, 0, 0);
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vErrorMsg = oResourceBundle.getText("nochangesinpast");

			oRecord.EmpId = vEmpId;
			oRecord.Begda = vFormattedDate;
			oRecord.UnitKey = vUnitKey;

			if (vBegda) {
				if (vBegda >= vCurrDate) {

					oBegda.setValueState(sap.ui.core.ValueState.None);
					oModel.create("/mainUnitSet", oRecord, {
						success: this.unitChangeSuccess.bind(this),
						error: function (oError) {
							this._oChangeUnitDialog.setBusy(false);
							this.createError(oError);
						}.bind(this)
					});
				} else {
					oBegda.setValueState(sap.ui.core.ValueState.Error);
					oBegda.setValueStateText(vErrorMsg);
					oBegda.openValueStateMessage();
					this._oChangeUnitDialog.setBusy(false);
				}
			} else {
				oBegda.setValueState(sap.ui.core.ValueState.Error);
				this._oChangeUnitDialog.setBusy(false);
			}
		},

		unitChangeSuccess: function () {
			this._oChangeUnitDialog.setBusy(false);
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vSuccesMessage = oResourceBundle.getText("unitchangesuccess");
			MessageToast.show(vSuccesMessage);
			this.getCuTableData();
		},

		destroyChangeUnitDialog: function (oEvent) {
			this._oChangeUnitDialog.destroy();
			this._oChangeUnitDialog = null;
		},

		onCloseChangeUnitDialog: function (oEvent) {
			this._oChangeUnitDialog.close();
		},

		handleSuggestAufnr: function (oEvent) {
			var sTerm = oEvent.getParameter("suggestValue");
			var vMatnr = sap.ui.getCore().byId("ld_inp_matnr").getValue().split(" ")[0];
			var aFilters = [];
			if (sTerm && sTerm != " ") {
				aFilters.push(new sap.ui.model.Filter("Aufnr", sap.ui.model.FilterOperator.StartsWith, sTerm));
			}
			if (vMatnr) {
				aFilters.push(new sap.ui.model.Filter("Matnr", sap.ui.model.FilterOperator.StartsWith, vMatnr));
			}
			oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
		},

		onAufnrChange: function (oEvent) {
			this.CicoDirty = true;
			var oModel = this.getView().getModel();
			if (oEvent.getParameter("newValue") != "") {
				var vAufnr = oEvent.getSource().getValue().split(" ")[0];
				oModel.read("/matNrSet('" + vAufnr + "')", {
					success: this.matNrSuccess.bind(this),
					error: function (oError) {}.bind(this)
				});
			} else {
				sap.ui.getCore().byId("ld_inp_matnr").setEnabled(true);
				sap.ui.getCore().byId("ld_inp_matnr").setValue();
			}
		},

		onMatnrChange: function (oEvent) {
			this.CicoDirty = true;
			/*			var oModel = this.getView().getModel();*/
			/*			if (oEvent.getParameter("newValue") != "") {*/
			/*				var vMatnr = oEvent.getSource().getValue().split(" ")[0];*/
			/*				var oMatnrFilter = new sap.ui.model.Filter("Matnr", sap.ui.model.FilterOperator.EQ, vMatnr);*/
			/*				var oAufnr = sap.ui.getCore().byId("ld_inp_aufnr");
							var vAufnr = oAufnr.getValue().split(" ")[0];*/
			/*				var oAufnrFilter = new sap.ui.model.Filter("Aufnr", sap.ui.model.FilterOperator.EQ, vAufnr);*/

			// oModel.read("/aufNrSet", {
			// 	filters: [oMatnrFilter, oAufnrFilter],
			// 	success: this.aufNrSuccess.bind(this),
			// 	error: function (oError) {}.bind(this)
			// });
			/*			} else {
							sap.ui.getCore().byId("ld_inp_aufnr").setValue();
						}*/
		},

		aufNrSuccess: function (oData) {
			var aData = oData.results;
			sap.ui.getCore().byId("ld_inp_matnr").setValueState(sap.ui.core.ValueState.None);
			sap.ui.getCore().byId("ld_inp_aufnr").setValueState(sap.ui.core.ValueState.None);
			if (aData.length === 1 && oData.results[0].Aufnr) {
				sap.ui.getCore().byId("ld_inp_aufnr").setValue(oData.results[0].Aufnr + " - " + oData.results[0].Description);
			}
		},

		matNrSuccess: function (oData) {
			sap.ui.getCore().byId("ld_inp_aufnr").setValueState(sap.ui.core.ValueState.None);
			sap.ui.getCore().byId("ld_inp_matnr").setValue(oData.Matnr + " - " + oData.Description);
		},

		handleSuggestMatnr: function (oEvent) {
			var sTerm = oEvent.getParameter("suggestValue");
			var aFilters = [];
			if (sTerm) {
				aFilters.push(new sap.ui.model.Filter("Matnr", sap.ui.model.FilterOperator.StartsWith, sTerm));
			}
			oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
		},

		handleSuggestZulage: function (oEvent) {
			var sTerm = oEvent.getParameter("suggestValue");
			//Anpassung Suche abhängig von Mitarbeiter und Tag möglich Yannick Ruppert 04.03.20
			//			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			//			var vEmpId = oEmpSelect.getSelectedKey();
			//			var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);*/
			var oDate = sap.ui.getCore().byId("ld_dp_date");
			var vDateValue = oDate.getDateValue();
			if (vDateValue !== null) {
				vDateValue.setHours(12);
			}
			//			var oDateFilter = new sap.ui.model.Filter("Datum", sap.ui.model.FilterOperator.EQ, vDateValue);*/
			//Ende Anpassung, unten werden noch die Filter zum Filterarray hinzugefügt

			var aFilters = [];
			if (sTerm) {
				aFilters.push(new sap.ui.model.Filter("Zulage", sap.ui.model.FilterOperator.StartsWith, sTerm));
				//Anpassung Filter hinzufügen
				//				aFilters.push(oEmpIdFilter);
				//				aFilters.push(oDateFilter);
				//Ende Anpassung
			}
			oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
		},

		handleSuggestKostenst: function (oEvent) {
			var sTerm = oEvent.getParameter("suggestValue");
			var aFilters = [];
			if (sTerm) {
				aFilters.push(new sap.ui.model.Filter("Kostenst", sap.ui.model.FilterOperator.StartsWith, sTerm));
			}
			oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
		},

		//****************************************TimesOverview.fragment.xml****************************************BEGIN

		onStartRptimeTimesOverview: function (oEvent) {
			var oModel = this.getView().getModel();
			//get emp from emp select
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			oEmpSelect.setValueState(sap.ui.core.ValueState.None);
			var vEmpid = oEmpSelect.getSelectedKey();
			//get unitkey from custom data
			var vUnitKey = Helper.getCustomDataValue(oEmpSelect.getSelectedItem().getAggregation("customData"), "UnitKey");
			//no info considering date-> use today for now
			var vBegda = new Date();
			var vEndda = vBegda;
			var oPanel = sap.ui.getCore().byId("pnl_rptime");
			var oBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, vBegda);
			var oEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, vEndda);
			var oEmpIdsFilter = new sap.ui.model.Filter("EmpIds", sap.ui.model.FilterOperator.EQ, vEmpid);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			oPanel.setBusy(true);
			oModel.read("/rptimeSet", {
				filters: [oEmpIdsFilter, oBegdaFilter, oEnddaFilter, oUnitFilter],
				success: function () {
					var oRptimeLogButton = sap.ui.getCore().byId("btn_rptimemsg_" + vUnitKey);

					this._oRptime.clearBuffer(vUnitKey);
					oRptimeLogButton.setType(sap.m.ButtonType.Unstyled);
					oRptimeLogButton.setText("");

					this.heartBeatTrigger = new sap.ui.core.IntervalTrigger(1);
					this.heartBeatTrigger.setInterval(3000);

					setTimeout(function () {
						this.heartBeatTrigger.addListener(function () {
							this.getRptimeDataInInterval(vUnitKey, "TimeOverview");
						}.bind(this));
					}.bind(this), 1000);
				}.bind(this)
			});
		},

		bindRptimeMsgTimesOverview: function () {
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oEmpFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, oEmpSelect.getSelectedKey());
			var oModel = this.getView().getModel();
			var oMessageList = sap.ui.getCore().byId("li_rp_to_msg");
			var oTemplate = sap.ui.getCore().byId("oli_rp_to_template");

			oMessageList.setModel(oModel);
			oMessageList.bindAggregation("items", {
				path: "/rptimeEmpLogSet",
				template: oTemplate,
				filters: [oEmpFilter],
				events: {
					dataReceived: function (oData) {}
				}
			});
		},

		onClickRptimeMsg: function (oEvent) {
			var oModel = this.getView().getModel();
			if (sap.ui.getCore().byId("ld_select_attention")) {
				sap.ui.getCore().byId("ld_select_attention").destroy();
			}

			if (sap.ui.getCore().byId("ta_attent_explain")) {
				sap.ui.getCore().byId("ta_attent_explain").destroy();
			}

			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vNoAttentionPossible = oResourceBundle.getText("noCompletionPossible");

			var oSource = oEvent.getSource();
			var oCtx = oSource.getBindingContext();

			var oPopover = new sap.m.Popover({
				title: "{i18n>completePopoverTitle}",
				beforeClose: function () {
					this.oPopoverOpen = false;
				},
				placement: "Auto"
			});
			this.getView().addDependent(oPopover);

			var oAttentionForm = new sap.ui.layout.form.SimpleForm({
				columnsXL: 12,
				columnsL: 12,
				columnsM: 12,
				layout: "ResponsiveGridLayout"
			});
			oPopover.addContent(oAttentionForm);

			var oTemplate = new sap.ui.core.Item({
				text: "{NoteText}",
				key: "{NoteKey}",
				customData: {
					key: "noteKey",
					value: "{NoteKey}"
				},
				layoutData: new sap.ui.layout.GridData({
					span: "XL12 L12 M12 S12"
				})
			});

			var oAttentionReasonSelect = new sap.m.Select({
				id: "ld_select_attention",
				selectedKey: "{SelAttention}"
			});

			var oExplanationTextArea = new sap.m.TextArea({
				id: "ta_attent_explain",
				layoutData: new sap.ui.layout.GridData({
					span: "XL12 L12 M12 S12"
				}),
				maxLength: 100,
				showExceededText: false,
				value: "{MsgExplanation}"
			});

			var oBegda = oModel.getProperty("Begda", oCtx);
			var oEndda = oModel.getProperty("Endda", oCtx);
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var vMessageType = oModel.getProperty("MessageType", oCtx);
			var vMessageText = oModel.getProperty("MessageText", oCtx);
			var vMsgParam = oModel.getProperty("MsgParam", oCtx);
			var vAttention = oModel.getProperty("Attention", oCtx);
			var vUnitKey = Helper.getCustomDataValue(oEmpSelect.getSelectedItem().getAggregation("customData"), "UnitKey");
			var vSumKey = "Unwichtig";
			var vNoteKey = "Unwichtig2";

			var oMsgTypeFilter = new sap.ui.model.Filter("MsgType", sap.ui.model.FilterOperator.EQ, vMessageType);
			var oDateFilter = new sap.ui.model.Filter("PlanDate", sap.ui.model.FilterOperator.EQ, oBegda);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oSumFilter = new sap.ui.model.Filter("SumKey", sap.ui.model.FilterOperator.EQ, vSumKey);

			var oMessageComplete = {};
			oMessageComplete.Begda = oBegda;
			oMessageComplete.Endda = oEndda;
			oMessageComplete.EmpId = oEmpSelect.getSelectedKey();
			oMessageComplete.MessageType = vMessageType;
			oMessageComplete.MessageText = vMessageText;
			oMessageComplete.MsgParam = vMsgParam;

			var oAttentionButton = new sap.m.Button({
				text: "{i18n>completeMessage}",
				press: this.onMsgCompletionButtonClick.bind(this, oMessageComplete, oPopover, vUnitKey),
				layoutData: new sap.ui.layout.GridData({
					span: "XL12 L12 M12 S12"
				})
			});

			oAttentionReasonSelect.setModel(oModel);
			oAttentionReasonSelect.bindItems({
				path: "/messageNoteSet",
				template: oTemplate,
				filters: [oMsgTypeFilter, oDateFilter, oUnitFilter, oSumFilter],
				events: {
					dataReceived: function () {
						// this.setSelectedItem(oData, vItemToSelect);
						oPopover.setBusy(false);
					}.bind(this)
				}
			});

			var sPath = oModel.createKey("/messageNoteSet", {
				SumKey: vSumKey,
				UnitKey: vUnitKey,
				NoteKey: vNoteKey,
				PlanDate: oBegda
			});

			oPopover.setModel(oModel);
			oPopover.bindElement({
				path: sPath,
				events: {
					dataReceived: function () {
						oPopover.setBusy(false);
					}.bind(this)
				}
			});

			this.oMsgAttentionSource = oEvent.getSource();
			oPopover.openBy(oEvent.getSource());
			this.oPopoverOpen = true;
			// oPopover.setBusy(true);

			if (vAttention === 'X') {
				oAttentionForm.addContent(oAttentionReasonSelect);
				oAttentionForm.addContent(oAttentionButton);
				oAttentionForm.addContent(oExplanationTextArea);
			} else if (vAttention === "") {
				oPopover.setTitle(vNoAttentionPossible);
			}

		},

		// CEPOI_EXT 17.02.2021 >>>
		getEmpShift: function () {
			//TimesOverview
			var oModel = this.getView().getModel();
			var oPanel = sap.ui.getCore().byId("pnl_shift");
			var oDate = sap.ui.getCore().byId("ld_dp_date");
			var vDate = oDate.getDateValue();
			var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
				pattern: "yyyy-MM-ddTHH:mm:ss"
			});
			var vDateFormatted = oDateFormat.format(vDate);
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oSelectedItem = oEmpSelect.getSelectedItem();
			if (oSelectedItem) {
				var vEmpId = oSelectedItem.getKey();
				var aCustomData = oSelectedItem.getCustomData();
				var vUnitKey = Helper.getCustomDataValue(aCustomData, "UnitKey");
				var oDateFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, vDateFormatted);
				var oShiftSelect = sap.ui.getCore().byId("ld_select_shift");
				var oTemplate = new sap.ui.core.Item({
					text: "{ShiftName} - {ShiftKey}",
					key: "{ShiftKey}"
				});
				oPanel.setBusy(true);

				//AGC03042019 Yannick Ruppert, Schichten sind vom Personalteilbereich der MA abhängig, daher wird die EmpId des
				//ausgewählten Mitarbeiters mitgegeben (Hinzufügen des Filters)
				var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
				var oUnitKeyFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

				var oBlankItem = new sap.ui.core.Item({
					text: "",
					key: "dummy"
				});

				var oCtx = oModel.createEntry("/availEmpShiftSet", {
					properties: {
						Begda: "",
						Beguz: "000000",
						EmpId: vEmpId,
						Enduz: "000000",
						ShiftKey: "dummy",
						ShiftName: "",
						UnitKey: vUnitKey,
						Varia: ""
					}
				});

				oShiftSelect.setModel(oModel);
				oShiftSelect.bindAggregation("items", {
					path: "/availEmpShiftSet",
					template: oTemplate,
					filters: [oDateFilter, oEmpIdFilter, oUnitKeyFilter],
					events: {
						dataReceived: function () {
							oShiftSelect.insertItem(oBlankItem, 0);
							this.getCurrEmpShift(vEmpId, vDateFormatted);
						}.bind(this)
					}
				});

			}

		},

		getCurrEmpShift: function (vEmpId, vDateFormatted) {
			var oModel = this.getView().getModel();
			var oForm = sap.ui.getCore().byId("to_sf_shift");
			var sPath = oModel.createKey("/substitutionSet", {
				Empid: vEmpId,
				ShiftDate: vDateFormatted,
				Tprog: '',
				SubstTprog: '',
				SubstSubty: ''
			});
			oForm.setModel(oModel);
			oForm.bindElement({
				path: sPath,
				events: {
					dataReceived: function () {
						this.onGetEmpShiftSuccess();
					}.bind(this)
				}
			});
		},

		onGetEmpShiftSuccess: function () {
			var oPanel = sap.ui.getCore().byId("pnl_shift");
			var oVoluntaryShift = sap.ui.getCore().byId("chb_voluntary");
			var oChbOwnShift = sap.ui.getCore().byId("chb_ownShiftTimes");
			var oBeguzShift = sap.ui.getCore().byId("ld_tp_beguz_shift");
			var oEnduzShift = sap.ui.getCore().byId("ld_tp_enduz_shift");
			var oBeguzAbw = sap.ui.getCore().byId("ld_tp_beguz_leave");
			var oBeguzBreak1 = sap.ui.getCore().byId("ld_tp_beguz_break1");
			var oEnduzBreak1 = sap.ui.getCore().byId("ld_tp_enduz_break1");
			var oBeguzBreak2 = sap.ui.getCore().byId("ld_tp_beguz_break2");
			var oEnduzBreak2 = sap.ui.getCore().byId("ld_tp_enduz_break2");
			var oVtart = sap.ui.getCore().byId("to_shift_select_subtype");
			var oForm = sap.ui.getCore().byId("to_sf_shift");
			var oShiftSelect = sap.ui.getCore().byId("ld_select_shift");
			var oContext = oForm.getBindingContext();
			var oShiftChangeCancel = sap.ui.getCore().byId("btn_shiftChangeCancel");
			var oSaveBtn = sap.ui.getCore().byId("btn_shiftChangeSave");
			var oModifyBtn = sap.ui.getCore().byId("btn_shiftChangeModify");
			var oTprogClass = sap.ui.getCore().byId("to_shift_select_tprogclass");
			var oOtShift = sap.ui.getCore().byId("ld_inp_integratedOT");
			var TZOffsetMs = new Date(0).getTimezoneOffset() * 60 * 1000;
			var oTimeFormatter = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "HH:mm:ss"
			});
			var oComdate = sap.ui.getCore().byId("ld_dp_comdat");
			var oComuzeit = sap.ui.getCore().byId("ld_tp_comuzeit");

			oPanel.setBusy(false);
			if (this.isFeatureEnabled("TO_TPROGCL")) {
				this.getTprogClassItems();
			}

			if (sap.ui.getCore().byId("to_shift_select_subtype").getVisible()) {
				this.getVtartItems();
			}

			if (oVoluntaryShift.getVisible()) {
				oVoluntaryShift.setSelected(oContext.getProperty("SubstVolSh"));
			}

			// CEPOI_EXT 12.02.2021 >>>
			if (oChbOwnShift.getVisible()) {
				oChbOwnShift.setSelected(oContext.getProperty("SubstOwnSh"));
			}
			// <<<

			if (oComdate.getVisible()) {
				if (oContext.getProperty("Comdate") !== null) {
					oComdate.setDateValue(oContext.getProperty("Comdate"));
					oComuzeit.setValue(oTimeFormatter.format(new Date(oContext.getProperty("Comuzeit").ms + TZOffsetMs)));
				} else {
					var currentdate = new Date();
					oComdate.setDateValue(currentdate);
					oComuzeit.setValue(oTimeFormatter.format(currentdate));
				}
			}

			//Wenn NewTprog keinen Wert hat und eigene Zeiten gefüllt sind, sind individuelle Schichtzeiten hinterlegt
			if (oContext.getProperty("SubstTprog") === "****") {
				this.toggleEnabledShiftInput(true);
				oChbOwnShift.setSelected(true);
				// CEPOI_EXT 17.02.2021 >>>
				// oBeguzShift.setValue(oContext.getProperty("SubstBeguz"));
				// oEnduzShift.setValue(oContext.getProperty("SubstEnduz"));
				// oBeguzBreak1.setValue(oContext.getProperty("SubstBeguzBr1"));
				// oEnduzBreak1.setValue(oContext.getProperty("SubstEnduzBr1"));
				// oBeguzBreak2.setValue(oContext.getProperty("SubstBeguzBr2"));
				// oEnduzBreak2.setValue(oContext.getProperty("SubstEnduzBr2"));
				// oBeguzAbw.setValue(oContext.getProperty("SubstBeguz"));
				oBeguzShift.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstBeguz").ms + TZOffsetMs)));
				oEnduzShift.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstEnduz").ms + TZOffsetMs)));
				oBeguzBreak1.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstBeguzBr1").ms + TZOffsetMs)));
				oEnduzBreak1.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstEnduzBr1").ms + TZOffsetMs)));
				oBeguzBreak2.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstBeguzBr2").ms + TZOffsetMs)));
				oEnduzBreak2.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstEnduzBr2").ms + TZOffsetMs)));
				oBeguzAbw.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstBeguz").ms + TZOffsetMs)));
				// <<<
				if (oVtart.getVisible()) {
					oVtart.setSelectedKey(oContext.getProperty("SubstVtart"));
					oVtart.setEnabled(false);
				}

				if (oTprogClass.getVisible()) {
					oTprogClass.setSelectedKey(oContext.getProperty("SubstTpkla"));
					// oTprogClass.setEnabled(false);
				}

				oShiftChangeCancel.setEnabled(true);
				if (oVoluntaryShift.getVisible()) {
					oVoluntaryShift.setEnabled(true);
				}
				oModifyBtn.setEnabled(true);
				oChbOwnShift.setEnabled(true);
				oBeguzShift.setEnabled(true);
				oEnduzShift.setEnabled(true);
				oBeguzBreak1.setEnabled(true);
				oEnduzBreak1.setEnabled(true);
				oBeguzBreak2.setEnabled(true);
				oEnduzBreak2.setEnabled(true);
				oShiftSelect.setEnabled(false);
				oSaveBtn.setEnabled(false);
				oPanel.setBusy(false);

				//Wenn NewTprog Wert hat sind keine individuellen Schichtzeiten hinterlegt
			} else if (oContext.getProperty("SubstTprog")) {
				var vShift = oContext.getProperty("SubstTprog");
				var oShiftSelectItem = oShiftSelect.getItemByKey(vShift);
				var vOtShift = oShiftSelectItem.getBindingContext().getObject().OtShift;
				oOtShift.setValue(vOtShift);
				this.toggleEnabledShiftInput(false);
				// CEPOI_EXT 17.02.2021 >>>
				// oBeguzShift.setValue(oContext.getProperty("SubstBeguz"));
				// oEnduzShift.setValue(oContext.getProperty("SubstEnduz"));
				// oBeguzAbw.setValue(oContext.getProperty("SubstBeguz"));
				oBeguzShift.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstBeguz").ms + TZOffsetMs)));
				oEnduzShift.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstEnduz").ms + TZOffsetMs)));
				oBeguzAbw.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstBeguz").ms + TZOffsetMs)));
				// <<<
				if (oVtart.getVisible()) {
					oVtart.setSelectedKey(oContext.getProperty("SubstVtart"));
					oVtart.setEnabled(true);
				}
				oShiftChangeCancel.setEnabled(true);
				if (oVoluntaryShift.getVisible()) {
					oVoluntaryShift.setEnabled(true);
				}

				if (oTprogClass.getVisible()) {
					oTprogClass.setEnabled(true);
				}
				oBeguzShift.setEnabled(false);
				oEnduzShift.setEnabled(false);
				oModifyBtn.setEnabled(true);
				oChbOwnShift.setEnabled(true);
				oShiftSelect.setEnabled(true);
				oSaveBtn.setEnabled(false);
				oPanel.setBusy(false);
				//Wenn weder NewTprog gefüllt und keine eigenen Zeiten hinterlegt hat der MA keine Schichtvertretung
			} else {
				this.toggleEnabledShiftInput(false);
				oBeguzBreak1.setValue();
				oBeguzBreak1.setVisible(false);
				oEnduzBreak1.setValue();
				oEnduzBreak1.setVisible(false);
				oBeguzBreak2.setValue();
				oBeguzBreak2.setVisible(false);
				oEnduzBreak2.setValue();
				oEnduzBreak2.setVisible(false);
				oTprogClass.setVisible(false);
				oShiftChangeCancel.setEnabled(false);
				oPanel.setBusy(false);
				if (oVoluntaryShift.getVisible()) {
					oVoluntaryShift.setEnabled(true);
				}
				oChbOwnShift.setEnabled(true);
				if (oVtart.getVisible()) {
					oVtart.setEnabled(true);
					oVtart.setSelectedKey("00");
				}
				oShiftSelect.setEnabled(true);
				oSaveBtn.setEnabled(true);
			}
		},
		// <<<

		getTprogClassItems: function () {
			var oModel = this.getView().getModel();
			var oTprogClass = sap.ui.getCore().byId("to_shift_select_tprogclass");
			var oTemplate = new sap.ui.core.Item({
				key: "{Tpkla}",
				text: "{Text}"
			});
			oTprogClass.setModel(oModel);
			oTprogClass.bindAggregation("items", {
				path: "/tprogClassSet",
				template: oTemplate
			});
		},

		getVtartItems: function () {
			var oModel = this.getView().getModel();
			var oDate = sap.ui.getCore().byId("ld_dp_currentDate").getDateValue();
			var sUnitKey = Helper.getCustomDataValue(this._oTimesOverviewDialog.getAggregation("customData"), "UnitKey");
			var iEmpId = sap.ui.getCore().byId("ld_select_emp").getSelectedKey();
			oDate = new Date(oDate);
			oDate.setHours(12);

			var oDateFilter = new sap.ui.model.Filter("Plandate", sap.ui.model.FilterOperator.EQ, oDate);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, sUnitKey);
			var oEmpFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, iEmpId);
			var oTemplate = new sap.ui.core.Item({
				key: "{Vtart}",
				text: {
					parts: ['Vtart', 'VtartText'],
					formatter: function (sArt, sText) {
						if (sArt == "00") {
							return "";
						} else {
							return sArt + " - " + sText;
						}
					}.bind(this)
				}
			});

			var oVtartSelect = sap.ui.getCore().byId("to_shift_select_subtype");
			oVtartSelect.setModel(oModel);
			oVtartSelect.bindAggregation("items", {
				path: "/vtArtSet",
				template: oTemplate,
				filters: [oDateFilter, oUnitFilter, oEmpFilter]
			});
		},

		// CEPOI_EXT 17.02.2021 >>>
		onSaveShiftChangeOverview: function () { //TIMESOVERVIEW
			var oModel = this.getView().getModel();
			var oPanelShift = sap.ui.getCore().byId("pnl_shift");
			oPanelShift.setBusy(true);

			var oShiftDate = sap.ui.getCore().byId("ld_dp_date");
			var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "yyyy-MM-ddTHH:mm:ss"
			});
			var oVoluntaryShift = sap.ui.getCore().byId("chb_voluntary");
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oOwnShift = sap.ui.getCore().byId("chb_ownShiftTimes");
			var oShiftSelect = sap.ui.getCore().byId("ld_select_shift");
			var oBeguzShift = sap.ui.getCore().byId("ld_tp_beguz_shift");
			var oEnduzShift = sap.ui.getCore().byId("ld_tp_enduz_shift");
			var oVtArtSelect = sap.ui.getCore().byId("to_shift_select_subtype");
			var oTprogClass = sap.ui.getCore().byId("to_shift_select_tprogclass");
			var oTimeFormatter = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "PTHH'H'mm'M'ss'S'"
			});
			var oComdat = sap.ui.getCore().byId("ld_dp_comdat");
			var oComuzeit = sap.ui.getCore().byId("ld_tp_comuzeit");

			var vShiftDate = oShiftDate.getDateValue();
			var vEmpId = oEmpSelect.getSelectedItem().getKey();
			var vDateFormatted = oDateFormat.format(vShiftDate);
			var vUnitKey = Helper.getCustomDataValue(oEmpSelect.getSelectedItem().getAggregation("customData"), "UnitKey");
			var vOwnShift = oOwnShift.getSelected();
			var vEnduzShift = oEnduzShift.getValue();
			var vBeguzShift = oBeguzShift.getValue();

			var vSubstTprog = oShiftSelect.getSelectedItem().getKey();

			if (vSubstTprog === "dummy") {
				oShiftSelect.setValueState(sap.ui.core.ValueState.Error);
				oPanelShift.setBusy(false);
				return;
			} else {
				oShiftSelect.setValueState(sap.ui.core.ValueState.None);
			}

			if (oVtArtSelect.getVisible()) {
				var vVtArt = oVtArtSelect.getSelectedKey();
				if (vVtArt === "00" && (vEmpId.match("^00"))) {
					oVtArtSelect.setValueState(sap.ui.core.ValueState.Error);
					oPanelShift.setBusy(false);
					return;
				} else {
					oVtArtSelect.setValueState(sap.ui.core.ValueState.None);
				}
			}
			if (oTprogClass.getVisible()) {
				var vTprogClass = oTprogClass.getSelectedItem().getKey();
				if (vTprogClass === "") {
					oTprogClass.setValueState(sap.ui.core.ValueState.Error);
					oPanelShift.setBusy(false);
					return;
				} else {
					oTprogClass.setValueState(sap.ui.core.ValueState.None);
				}
			}

			var oBeguzBreak1 = sap.ui.getCore().byId("ld_tp_beguz_break1");
			var oEnduzBreak1 = sap.ui.getCore().byId("ld_tp_enduz_break1");
			var oBeguzBreak2 = sap.ui.getCore().byId("ld_tp_beguz_break2");
			var oEnduzBreak2 = sap.ui.getCore().byId("ld_tp_enduz_break2");

			var vVaria = this.getView().getModel().getProperty("Varia", oShiftSelect.getSelectedItem().getBindingContext());

			//Prüfung: Wenn eigene Schichtzeit gewählt aber keine Uhrzeiten eingetragen:
			if (vOwnShift && (vBeguzShift === "" || vEnduzShift === "")) {
				if (vBeguzShift === "") {
					oBeguzShift.setValueState(sap.ui.core.ValueState.Error);
				}
				if (vEnduzShift === "") {
					oEnduzShift.setValueState(sap.ui.core.ValueState.Error);
				}
				oPanelShift.setBusy(false);

				//Prüfung erfolgreich: Daten der eigenen Schichtzeit auslesen
			} else {
				if (vOwnShift === true) {
					vSubstTprog = "****";
				}

				var oRecord = {};
				oRecord.Empid = vEmpId;
				oRecord.ShiftDate = vDateFormatted;
				oRecord.SubstTprog = vSubstTprog;
				if (oBeguzShift.getDateValue()) {
					oRecord.SubstBeguz = oTimeFormatter.format(oBeguzShift.getDateValue());
				}
				if (oEnduzShift.getDateValue()) {
					oRecord.SubstEnduz = oTimeFormatter.format(oEnduzShift.getDateValue());
				}
				if (oBeguzBreak1.getDateValue()) {
					oRecord.SubstBeguzBr1 = oTimeFormatter.format(oBeguzBreak1.getDateValue());
				}
				if (oEnduzBreak1.getDateValue()) {
					oRecord.SubstEnduzBr1 = oTimeFormatter.format(oEnduzBreak1.getDateValue());
				}
				if (oBeguzBreak2.getDateValue()) {
					oRecord.SubstBeguzBr2 = oTimeFormatter.format(oBeguzBreak2.getDateValue());
				}
				if (oEnduzBreak2.getDateValue()) {
					oRecord.SubstEnduzBr2 = oTimeFormatter.format(oEnduzBreak2.getDateValue());
				}
				oRecord.SubstOwnSh = vOwnShift;
				oRecord.SubstTdtype = this.getView().getModel().getProperty("ShiftTdtype", oShiftSelect.getSelectedItem().getBindingContext());
				if (oRecord.SubstTdtype === null) {
					oRecord.SubstTdtype = "";
				}
				if (oVoluntaryShift.getVisible()) {
					oRecord.SubstVolSh = oVoluntaryShift.getSelected();
				} else {
					oRecord.SubstVolSh = false;
				}
				oRecord.SubstVtart = vVtArt;
				// oRecord.NewShiftKey = vEmpId + vDateFormatted + vBeguzShift + vEnduzShift + vBeguzBreak1 + vEnduzBreak1 + vBeguzBreak2 +
				// 	vEnduzBreak2 + vNewTprog;
				oRecord.SubstVaria = vVaria;
				if (oTprogClass.getVisible()) {
					oRecord.SubstTpkla = vTprogClass.toString();
				}
				if (oComdat.getVisible()) {
					var vComdate = oComdat.getDateValue();
					var vComDateFormatted = oDateFormat.format(vComdate);
					oRecord.Comdate = vComDateFormatted;
					if (oComuzeit.getDateValue()) {
						oRecord.Comuzeit = oTimeFormatter.format(oComuzeit.getDateValue());
					}
				}

				oModel.create("/substitutionSet", oRecord, {
					refreshAfterChange: true,
					success: this.createEmpShiftSuccess.bind(this),
					error: function (oError) {
						this.createError(oError);
						oPanelShift.setBusy(false);
					}.bind(this)
				});
			}
		},

		onModifyShiftChangeOverview: function () {
			var oPanelShift = sap.ui.getCore().byId("pnl_shift");
			oPanelShift.setBusy(true);

			var oShiftChangeCancel = sap.ui.getCore().byId("btn_shiftChangeCancel");
			var oForm = sap.ui.getCore().byId("to_sf_shift");
			var oObject = oForm.getBindingContext().getObject();
			var oShiftSelect = sap.ui.getCore().byId("ld_select_shift");
			var oModel = this.getView().getModel();
			var oTprogClass = sap.ui.getCore().byId("to_shift_select_tprogclass");
			var oVtArtSelect = sap.ui.getCore().byId("to_shift_select_subtype");
			var vSubstTprog = oShiftSelect.getSelectedItem().getKey();
			var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "yyyy-MM-ddTHH:mm:ss"
			});

			if (vSubstTprog === "dummy") {
				oShiftSelect.setValueState(sap.ui.core.ValueState.Error);
				oPanelShift.setBusy(false);
				return;
			} else {
				oShiftSelect.setValueState(sap.ui.core.ValueState.None);
			}

			if (oVtArtSelect.getVisible()) {
				var vVtArt = oVtArtSelect.getSelectedKey();
				if (vVtArt === "00" && (oObject.EmpId.match("^00"))) {
					oVtArtSelect.setValueState(sap.ui.core.ValueState.Error);
					oPanelShift.setBusy(false);
					return;
				} else {
					oVtArtSelect.setValueState(sap.ui.core.ValueState.None);
				}
			}
			if (oTprogClass.getVisible()) {
				var vTprogClass = oTprogClass.getSelectedItem().getKey();
				if (vTprogClass === "") {
					oTprogClass.setValueState(sap.ui.core.ValueState.Error);
					oPanelShift.setBusy(false);
					return;
				} else {
					oTprogClass.setValueState(sap.ui.core.ValueState.None);
				}
			}

			// var sShiftKey = oObject.EmpId + oObject.ShiftDate + oObject.UnitKey + oObject.Vtart + oObject.NewShiftKey;
			var sPath = oModel.createKey("/substitutionSet", {
				Empid: oObject.Empid,
				Tprog: '',
				// ShiftKey: sShiftKey,
				ShiftDate: oDateFormat.format(oObject.ShiftDate),
				SubstTprog: oObject.SubstTprog,
				SubstSubty: oObject.SubstSubty
			});

			oModel.remove(sPath, {
				success: function (oData) {
					oShiftChangeCancel.setEnabled(false);
					this.onSaveShiftChangeOverview();
				}.bind(this),
				error: function (oError) {
					this.createError(oError);
				}.bind(this)
			});
		},
		// <<<
		//****************************************TimesOverview.fragment.xml****************************************END

		setPnlShiftFieldVisibility: function (vChecked) { //TIMESOVERVIEW
			var oShiftSelect = sap.ui.getCore().byId("ld_select_shift");
			var oBeguzShift = sap.ui.getCore().byId("ld_tp_beguz_shift");
			var oEnduzShift = sap.ui.getCore().byId("ld_tp_enduz_shift");
			var oLabelBreak1 = sap.ui.getCore().byId("lbl_break1");
			var oBeguzBreak1 = sap.ui.getCore().byId("ld_tp_beguz_break1");
			var oEnduzBreak1 = sap.ui.getCore().byId("ld_tp_enduz_break1");
			var oLabelBreak2 = sap.ui.getCore().byId("lbl_break2");
			var oBeguzBreak2 = sap.ui.getCore().byId("ld_tp_beguz_break2");
			var oEnduzBreak2 = sap.ui.getCore().byId("ld_tp_enduz_break2");
			var oTprogClass = sap.ui.getCore().byId("to_shift_select_tprogclass");

			if (vChecked) {
				oShiftSelect.setEnabled(false);
				oBeguzShift.setEnabled(true);
				oEnduzShift.setEnabled(true);
				oLabelBreak1.setVisible(true);
				oBeguzBreak1.setVisible(true);
				oBeguzBreak1.setEnabled(true);
				oEnduzBreak1.setVisible(true);
				oEnduzBreak1.setEnabled(true);
				oLabelBreak2.setVisible(true);
				oBeguzBreak2.setVisible(true);
				oBeguzBreak2.setEnabled(true);
				oEnduzBreak2.setVisible(true);
				oEnduzBreak2.setEnabled(true);
				if (this.isFeatureEnabled("TO_TPROGCL")) {
					oTprogClass.setVisible(true);
				}
			} else {
				oShiftSelect.setEnabled(true);
				oBeguzShift.setEnabled(false);
				oEnduzShift.setEnabled(false);
				oLabelBreak1.setVisible(false);
				oBeguzBreak1.setVisible(false);
				oEnduzBreak1.setVisible(false);
				oLabelBreak2.setVisible(false);
				oBeguzBreak2.setVisible(false);
				oEnduzBreak2.setVisible(false);
				oTprogClass.setVisible(false);
			}
		},

		// CEPOI_EXT 17.02.2021 >>>
		toggleEnabledShiftInput: function (vSelected) { //TIMESOVERVIEW
			var oCurrentShift = sap.ui.getCore().byId("ld_inp_shiftPlan");
			var oShiftSelect = sap.ui.getCore().byId("ld_select_shift");
			var oBeguzShift = sap.ui.getCore().byId("ld_tp_beguz_shift");
			var oEnduzShift = sap.ui.getCore().byId("ld_tp_enduz_shift");
			var oSubty = sap.ui.getCore().byId("to_shift_select_subtype");
			var oOtShift = sap.ui.getCore().byId("ld_inp_integratedOT");
			var oOtShiftLbl = sap.ui.getCore().byId("ld_lbl_integratedOT");
			var oForm = sap.ui.getCore().byId("to_sf_shift");
			var oVoluntary = sap.ui.getCore().byId("chb_voluntary");
			var oContext = oForm.getBindingContext();
			var TZOffsetMs = new Date(0).getTimezoneOffset() * 60 * 1000;
			var oTimeFormatter = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "HH:mm:ss"
			});
			this.setPnlShiftFieldVisibility(vSelected);
			if (vSelected === true) {
				if (this.isFeatureEnabled("TO_INTEGOT")) {
					oOtShift.setVisible(false);
					oOtShiftLbl.setVisible(false);
				}
				var oItem = new sap.ui.core.Item({
					text: this.getResourceBundleText("individuell"),
					key: "****"
				});
				var oCustomData = new sap.ui.core.CustomData({
					key: "OldShiftKey",
					// writeToDom: true,
					value: oCurrentShift.getSelectedKey()
				});
				oItem.addCustomData(oCustomData);
				oShiftSelect.addItem(oItem);
				oShiftSelect.setSelectedItem(oItem);

			} else {
				if (this.isFeatureEnabled("TO_INTEGOT")) {
					oOtShift.setVisible(true);
					oOtShiftLbl.setVisible(true);
				}
				if (oShiftSelect.getSelectedKey() === "****") {
					var vOwnShiftKey = Helper.getCustomDataValue(oShiftSelect.getSelectedItem().getAggregation("customData"), "OldShiftKey");
					oShiftSelect.removeItem(oShiftSelect.getSelectedIndex());
					oShiftSelect.setSelectedKey(vOwnShiftKey);
				}
				if (oContext.getProperty("SubstTprog")) {
					oShiftSelect.setSelectedKey(oContext.getProperty("SubstTprog"));
					if (oSubty.getVisible()) {
						oSubty.setSelectedKey(oContext.getProperty("SubstVtart"));
					}
					if (oVoluntary.getVisible()) {
						if (oContext.getProperty("SubstVolSh")) {
							oVoluntary.setSelected(true);
						} else {
							oVoluntary.setSelected(false);
						}
					}
					// oBeguzShift.setValue(oContext.getProperty("SubstBeguz"));
					// oEnduzShift.setValue(oContext.getProperty("SubstEnduz"));
					oBeguzShift.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstBeguz").ms + TZOffsetMs)));
					oEnduzShift.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstEnduz").ms + TZOffsetMs)));
				} else {
					oShiftSelect.setSelectedKey("dummy");
					oBeguzShift.setValue("");
					oEnduzShift.setValue("");
					if (oVoluntary.getVisible()) {
						oVoluntary.setSelected(false);
					}
					if (oSubty.getVisible()) {
						oSubty.setSelectedKey(oContext.getProperty("SubstVtart"));
					}
				}
			}
		},

		onNewShiftSelect: function () { //TIMESOVERVIEW
			var oOtShift = sap.ui.getCore().byId("ld_inp_integratedOT");
			var oShiftSelect = sap.ui.getCore().byId("ld_select_shift");
			oShiftSelect.setValueState(sap.ui.core.ValueState.None);
			var vSelectShift = oShiftSelect.getSelectedItem();
			oShiftSelect.setSelectedItem(vSelectShift);
			var vOtShift = vSelectShift.getBindingContext().getObject().OtShift;
			oOtShift.setValue(vOtShift);
			var oContext = oShiftSelect.getSelectedItem().getBindingContext();
			var oObject = oContext.getObject();
			// var vBeguz = oObject.Beguz;
			// var vEnduz = oObject.Enduz;
			var vBeguz = oObject.Beguz + "0";
			var vEnduz = oObject.Enduz + "0";
			var oBeguz = sap.ui.getCore().byId("ld_tp_beguz_shift");
			var oEnduz = sap.ui.getCore().byId("ld_tp_enduz_shift");
			var oComdate = sap.ui.getCore().byId("ld_dp_comdat");
			var oComuzeit = sap.ui.getCore().byId("ld_tp_comuzeit");
			var oTimeFormatter = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "HH:mm:ss"
			});
			this.ShiftDirty = true;
			oBeguz.setValue(vBeguz);
			oEnduz.setValue(vEnduz);

			if (oComdate.getVisible()) {
				var currentdate = new Date();
				oComdate.setDateValue(currentdate);
				oComuzeit.setValue(oTimeFormatter.format(currentdate));
			}
		},
		// <<<

		createEmpShiftSuccess: function () {
			var oShiftSelect = sap.ui.getCore().byId("ld_select_shift");
			if (oShiftSelect.getSelectedKey() === "****") {
				oShiftSelect.removeItem(oShiftSelect.getSelectedIndex());
			}
			var oPanelShift = sap.ui.getCore().byId("pnl_shift");
			sap.ui.getCore().byId("btn_shiftChangeCancel").setEnabled(true);
			this.getEmpShift();
			this.ShiftDirty = false;
			oPanelShift.setBusy(false);
			MessageToast.show(this.getResourceBundleText("shiftchangecreated"));
		},

		// CEPOI_EXT 17.02.2021 >>>
		onCancelShiftChangeOverview: function (oEvent) { //TIMESOVERVIEW
			var oShiftChangeCancel = sap.ui.getCore().byId("btn_shiftChangeCancel");
			oShiftChangeCancel.setEnabled(false);
			var oForm = sap.ui.getCore().byId("to_sf_shift");
			var oObject = oForm.getBindingContext().getObject();
			var oModel = this.getView().getModel();

			// var sShiftKey = oObject.EmpId + oObject.ShiftDate + oObject.UnitKey + oObject.Vtart + oObject.NewShiftKey;
			var sPath = oModel.createKey("/substitutionSet", {
				Empid: oObject.Empid,
				Tprog: '',
				// ShiftKey: sShiftKey,
				ShiftDate: oObject.ShiftDate,
				SubstTprog: oObject.SubstTprog,
				SubstSubty: oObject.SubstSubty
			});

			oModel.remove(sPath, {
				success: this.deleteEmpShiftSuccess.bind(this),
				error: function (oError) {
					this.createError(oError);
				}.bind(this)
			});
		},
		// <<< 

		deleteEmpShiftSuccess: function () {
			this.clearShiftInput();
			this.getEmpShift();
			sap.ui.getCore().byId("btn_shiftChangeCancel").setEnabled(false);
			MessageToast.show(this.getResourceBundleText("shiftchangedeleted"));
		},

		clearShiftInput: function () {
			var oOwnShiftTimes = sap.ui.getCore().byId("chb_ownShiftTimes");
			var oShiftSelect = sap.ui.getCore().byId("ld_select_shift");
			var oLblBeguzBreak1 = sap.ui.getCore().byId("lbl_break1");
			var oBeguzBreak1 = sap.ui.getCore().byId("ld_tp_beguz_break1");
			var oEnduzBreak1 = sap.ui.getCore().byId("ld_tp_enduz_break1");
			var oLblBeguzBreak2 = sap.ui.getCore().byId("lbl_break2");
			var oBeguzBreak2 = sap.ui.getCore().byId("ld_tp_beguz_break2");
			var oEnduzBreak2 = sap.ui.getCore().byId("ld_tp_enduz_break2");
			var oVoluntaryShift = sap.ui.getCore().byId("chb_voluntary");
			var oTprogClass = sap.ui.getCore().byId("to_shift_select_tprogclass");
			var oVtart = sap.ui.getCore().byId("to_shift_select_subtype");
			var oChangeButton = sap.ui.getCore().byId("btn_shiftChangeModify");

			oChangeButton.setEnabled(false);
			oOwnShiftTimes.setSelected(false);
			oShiftSelect.setEnabled(true);
			oLblBeguzBreak1.setVisible(false);
			oBeguzBreak1.setValue();
			oBeguzBreak1.setVisible(false);
			oEnduzBreak1.setValue();
			oEnduzBreak1.setVisible(false);
			oLblBeguzBreak2.setVisible(false);
			oBeguzBreak2.setValue();
			oBeguzBreak2.setVisible(false);
			oEnduzBreak2.setValue();
			oEnduzBreak2.setVisible(false);
			oVoluntaryShift.setSelected(false);
			oTprogClass.setVisible(false);
			oTprogClass.setSelectedIndex(0);
			oTprogClass.setEnabled(true);
			oVtart.setSelectedIndex(0);
		},

		onOwnShiftTimeSelect: function (oEvent) {
			var oComdate = sap.ui.getCore().byId("ld_dp_comdat");
			var oComuzeit = sap.ui.getCore().byId("ld_tp_comuzeit");
			var oTimeFormatter = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "HH:mm:ss"
			});

			this.toggleEnabledShiftInput(oEvent.getParameter("selected"));

			if (oComdate.getVisible()) {
				var currentdate = new Date();
				oComdate.setDateValue(currentdate);
				oComuzeit.setValue(oTimeFormatter.format(currentdate));
			}
		},

		getTimeEventSet: function (vUnitKey) {
			var oModel = this.getView().getModel();
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oTimeEventSelect = sap.ui.getCore().byId("ld_select_timeevent");
			var oDate = sap.ui.getCore().byId("ld_dp_date");
			var vDateValue = oDate.getDateValue();
			if (vDateValue !== null) {
				vDateValue.setHours(12);
			}
			var oTemplate = new sap.ui.core.Item({
				text: "{CicotyText}",
				key: "{Cicoty}"
			});
			oTimeEventSelect.setModel(oModel);
			oTimeEventSelect.bindItems({
				path: "/cicoTypeSet",
				template: oTemplate,
				filters: [oUnitFilter],
				events: {
					dataReceived: function () {
						if (this._oCicoDialog) {
							this._oCicoDialog.setBusy(false);
						}
					}.bind(this)
				}
			});
		},

		onCicoEmployeeChange: function () {
			this.bindTimeEventTable();
		},

		// CEPOI_EXT 24.02.2021 >>>
		onSaveCico: function () {
			var oModel = this.getView().getModel();
			var oTable = sap.ui.getCore().byId("ld_tbl_cicooverview");
			oTable.setBusy(true);
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oDate = sap.ui.getCore().byId("ld_dp_date");
			var oTime = sap.ui.getCore().byId("ld_tp_uz");
			var oCicoTy = sap.ui.getCore().byId("ld_select_timeevent");
			var oCbPrev = sap.ui.getCore().byId("chb_cico_day");
			var vUnitKey;
			if (this._oCicoDialog) {
				vUnitKey = Helper.getCustomDataValue(this._oCicoDialog.getAggregation("customData"), "UnitKey");
			} else {
				vUnitKey = Helper.getCustomDataValue(this._oTimesOverviewDialog.getAggregation("customData"), "UnitKey");
			}
			if (sap.ui.getCore().byId("ld_inp_aufnr")) {
				var oAufnr = sap.ui.getCore().byId("ld_inp_aufnr");
				var vAufnr = oAufnr.getValue().split(" ")[0];
				var oMatnr = sap.ui.getCore().byId("ld_inp_matnr");
				var vMatnr = oMatnr.getValue().split(" ")[0];
				var oZulage = sap.ui.getCore().byId("ld_inp_zulage");
				var vZulage = oZulage.getValue();
				var oKostenst = sap.ui.getCore().byId("ld_inp_kostenst");
				var vKostenst = oKostenst.getValue().split(" ")[0];
			}
			var vEmpId = oEmpSelect.getSelectedItem().getKey();
			var vDate = oDate.getDateValue();
			// var vTime = oTime.getValue();
			var vTime = oTime.getDateValue();
			var vCicoTy = oCicoTy.getSelectedItem().getKey();
			var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				// pattern: "yyyyMMdd"
				pattern: "yyyy-MM-ddTHH:mm:ss"
			});
			var oTimeFormatter = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "PTHH'H'mm'M'ss'S'"
			});

			var vDateFormatted = oDateFormat.format(vDate);
			var vTimeFormatted = oTimeFormatter.format(vTime);
			var vPrev = oCbPrev.getSelected();
			if (vDate && vTime) {
				var oRecord = {};
				oRecord.EmpId = vEmpId;
				oRecord.Ldate = vDateFormatted;
				// oRecord.Ltime = vTime;
				oRecord.Ltime = vTimeFormatted;
				oRecord.TimeeventTy = vCicoTy;
				oRecord.Aufnr = vAufnr;
				oRecord.Matnr = vMatnr;
				oRecord.Zulage = vZulage;
				oRecord.Kostenst = vKostenst;
				oRecord.UnitKey = vUnitKey;
				oRecord.Prev = vPrev;

				oModel.create("/timeEventNSet", oRecord, {
					success: this.createCicoSuccess.bind(this),
					error: function (oError) {
						this.createError(oError);
						oTable.setBusy(false);
					}.bind(this)
				});
			} else {
				oTable.setBusy(false);
				if (!vDate) {
					oDate.setValueState(sap.ui.core.ValueState.Error);
				} else {
					oDate.setValueState(sap.ui.core.ValueState.None);
				}
				if (!vTime) {
					oTime.setValueState(sap.ui.core.ValueState.Error);
				} else {
					oTime.setValueState(sap.ui.core.ValueState.None);
				}
			}

		},
		// <<<

		createCicoSuccess: function () {
			this.CicoDirty = false;
			this.clearCicoInput();
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vCicoCreated = oResourceBundle.getText("cicocreated");
			MessageToast.show(vCicoCreated);
			this.toggleEnabledButtons("cico", -1);
			this.bindTimeEventTable();
			this.fillOvertimeTable();
		},

		clearCicoInput: function () {

			var oTime = sap.ui.getCore().byId("ld_tp_uz");
			var oCbPrev = sap.ui.getCore().byId("chb_cico_day");
			var oEventSelect = sap.ui.getCore().byId("ld_select_timeevent");
			var oTable = sap.ui.getCore().byId("ld_tbl_cicooverview");
			oTable.setSelectedIndex(-1);
			if (sap.ui.getCore().byId("ld_inp_aufnr")) {
				var oAufnr = sap.ui.getCore().byId("ld_inp_aufnr");
				var oMatnr = sap.ui.getCore().byId("ld_inp_matnr");
				var oZulage = sap.ui.getCore().byId("ld_inp_zulage");
				var oKostenst = sap.ui.getCore().byId("ld_inp_kostenst");

				oAufnr.setValue();
				oMatnr.setValue();
				oZulage.setValue();
				oKostenst.setValue();
			}

			oTime.setValue();
			oEventSelect.setSelectedIndex(0);
			oEventSelect.setSelectedKey(0);
			oCbPrev.setSelected(false);
		},

		// CEPOI_EXT 24.02.2021 >>>
		onUpdateCico: function () {
			var oModel = this.getView().getModel();
			var oTable = sap.ui.getCore().byId("ld_tbl_cicooverview");
			// oTable.setBusy(true);
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oDate = sap.ui.getCore().byId("ld_dp_date");
			var oTime = sap.ui.getCore().byId("ld_tp_uz");
			var oCicoTy = sap.ui.getCore().byId("ld_select_timeevent");
			var oCbPrev = sap.ui.getCore().byId("chb_cico_day");
			var vDate = oDate.getDateValue();
			//var vTime = oTime.getValue();
			var vTime = oTime.getDateValue();
			var vUnitKey;
			if (this._oCicoDialog) {
				vUnitKey = Helper.getCustomDataValue(this._oCicoDialog.getAggregation("customData"), "UnitKey");
			} else {
				vUnitKey = Helper.getCustomDataValue(this._oTimesOverviewDialog.getAggregation("customData"), "UnitKey");
			}
			if (sap.ui.getCore().byId("ld_inp_aufnr")) {
				var oAufnr = sap.ui.getCore().byId("ld_inp_aufnr");
				var vAufnr = oAufnr.getValue().split(" ")[0];
				var oMatnr = sap.ui.getCore().byId("ld_inp_matnr");
				var vMatnr = oMatnr.getValue().split(" ")[0];
				var oZulage = sap.ui.getCore().byId("ld_inp_zulage");
				var vZulage = oZulage.getValue();
				var oKostenst = sap.ui.getCore().byId("ld_inp_kostenst");
				var vKostenst = oKostenst.getValue();
				vKostenst = oKostenst.getValue().split(" ")[0];
			}
			var vCicoTy = oCicoTy.getSelectedItem().getKey();
			var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				// pattern: "yyyyMMdd"
				pattern: "yyyy-MM-ddTHH:mm:ss"
			});
			var oTimeFormatter = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "PTHH'H'mm'M'ss'S'"
			});
			var vDateFormatted = oDateFormat.format(vDate);
			var vTimeFormatted = oTimeFormatter.format(new Date(vTime));
			if (vDate && vTime) {
				var oRecord = {};
				oRecord.EmpId = oEmpSelect.getSelectedItem().getKey();
				oRecord.Ldate = vDateFormatted;
				// oRecord.Ltime = vTime;
				oRecord.Ltime = vTimeFormatted;
				oRecord.TimeeventTy = vCicoTy;
				oRecord.UnitKey = vUnitKey;
				oRecord.Prev = oCbPrev.getSelected();
				if (sap.ui.getCore().byId("ld_inp_aufnr")) {
					oRecord.Aufnr = vAufnr;
					oRecord.Matnr = vMatnr;
					oRecord.Zulage = vZulage;
					oRecord.Kostenst = vKostenst;
				}

				var sPath = "/" + oTable.getBinding().aKeys[oTable.getSelectedIndex()];

				oModel.update(sPath, oRecord, {
					success: this.updateCicoSuccess.bind(this),
					error: function (oError) {
						this.createError(oError);
						oTable.setBusy(false);
					}.bind(this)
				});
			} else {
				oTable.setBusy(false);
				if (!vDate) {
					oDate.setValueState(sap.ui.core.ValueState.Error);
				} else {
					oDate.setValueState(sap.ui.core.ValueState.None);
				}
				if (!vTime) {
					oTime.setValueState(sap.ui.core.ValueState.Error);
				} else {
					oTime.setValueState(sap.ui.core.ValueState.None);
				}
			}
		},
		// <<<

		updateCicoSuccess: function () {
			var oTable = sap.ui.getCore().byId("ld_tbl_cicooverview");
			oTable.setBusy(true);
			this.CicoDirty = false;
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vCicoCreated = oResourceBundle.getText("cicoupdated");
			MessageToast.show(vCicoCreated);
			this.clearCicoInput();
			this.toggleEnabledButtons("cico", -1);
			this.bindTimeEventTable();
			this.fillOvertimeTable();
		},

		onDeleteCico: function () {
			var oTable = sap.ui.getCore().byId("ld_tbl_cicooverview");
			oTable.setBusy(true);
			if (oTable.getSelectedIndex() !== -1) {
				Helper.openConfirmDialog("{i18n>deletecicosure}", "{i18n>areyousure}", "{i18n>deletecico}", this.deleteCico, null, this);
			} else {
				Helper.openNoSelectedEntryDialog("{i18n>noselectedEntry}", "{i18n>selectEntry}", null, this);
			}
			oTable.setBusy(false);
		},

		deleteCico: function (oController) {
			var oTable = sap.ui.getCore().byId("ld_tbl_cicooverview");
			var oContext = oTable.getContextByIndex(oTable.getSelectedIndex());
			var oModel = oController.getView().getModel();

			oModel.remove(oContext.sPath, {
				success: function (oData, oResponse) {
					oTable.setBusy(false);
					oController.deleteCicoSuccess();
				},
				error: function (oError) {
					oTable.setBusy(false);
					oController.createError(oError);
				}
			});

			if (sap.ui.getCore().byId("ld_inp_aufnr")) {
				sap.ui.getCore().byId("ld_inp_aufnr").setValue();
				sap.ui.getCore().byId("ld_inp_matnr").setValue();
				sap.ui.getCore().byId("ld_inp_zulage").setValue();
				sap.ui.getCore().byId("ld_inp_kostenst").setValue();
			}

		},

		deleteCicoSuccess: function () {
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vCicoDeleted = oResourceBundle.getText("cicodeleted");
			MessageToast.show(vCicoDeleted);
			var oTable = sap.ui.getCore().byId("ld_tbl_cicooverview");
			this.bindTimeEventTable();
			if (oTable.getBinding("rows").getLength() == 0) {
				sap.ui.getCore().byId("ld_tp_uz").setValue();
				sap.ui.getCore().byId("chb_cico_day").setSelected(false);
				this.toggleEnabledButtons("cico", -1);
			}
			this.fillOvertimeTable();
		},

		destroyCicoDialog: function (oEvent) {
			this._oCicoDialog.destroy();
			this._oCicoDialog = null;
		},

		onCloseCicoDialog: function (oEvent) {
			this._oCicoDialog.close();
		},

		onCancelCicoOverview: function (oEvent) {
			this.CicoDirty = false;
			this.clearCicoInput();
		},

		toggleEnabledButtons: function (vButtonCat, vIndex, vIsCico) {

			var vButtonName = "btn_" + vButtonCat;
			var oSaveButton = sap.ui.getCore().byId(vButtonName + "Save");
			var oEditButton = sap.ui.getCore().byId(vButtonName + "Edit");
			var oCancelButton = sap.ui.getCore().byId(vButtonName + "Cancel");

			if (oSaveButton && oEditButton && oCancelButton && vIsCico != true) {

				if (vIndex != undefined && vIndex != -1) {
					oSaveButton.setEnabled(false);
					oEditButton.setEnabled(true);
					oCancelButton.setEnabled(true);
				} else {
					oSaveButton.setEnabled(true);
					oEditButton.setEnabled(false);
					oCancelButton.setEnabled(false);
				}
			}
		},

		clearAbsPresInput: function () {
			var oBegda = sap.ui.getCore().byId("ld_dp_begda_leave");
			if (sap.ui.getCore().byId("ld_dp_currentDate")) {
				oBegda.setDateValue(sap.ui.getCore().byId("ld_dp_currentDate").getDateValue());
			}
			var oEndda = sap.ui.getCore().byId("ld_dp_endda_leave");
			oEndda.setDateValue(sap.ui.getCore().byId("ld_dp_currentDate").getDateValue());
			var oBeguz = sap.ui.getCore().byId("ld_tp_beguz_leave");
			if (oBeguz) {
				oBeguz.setValue();
			}
			var oEnduz = sap.ui.getCore().byId("ld_tp_enduz_leave");
			if (oEnduz) {
				oEnduz.setValue();
			}
			var oDuration = sap.ui.getCore().byId("ld_inp_duration_leave");
			if (oDuration) {
				oDuration.setValue();
			}
			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_leave");
			oSubtySelect.setSelectedIndex(0);
			var vSprps;
			if (sap.ui.getCore().byId("chb_sprps")) {
				vSprps = sap.ui.getCore().byId("chb_sprps").setSelected(false);
			}

		},

		onChangeDurationAbsence: function () {
			var oBeguz = sap.ui.getCore().byId("ld_tp_beguz_leave");
			var vBeguz = oBeguz.getDateValue();
			var oEnduz = sap.ui.getCore().byId("ld_tp_enduz_leave");
			var oDuration = sap.ui.getCore().byId("ld_inp_duration_leave");
			var vDuration = oDuration.getValue();
			if (vBeguz && vDuration) {
				var vnewEndDate = new Date(vBeguz.getTime() + (3600000 * vDuration));
				oEnduz.setDateValue(vnewEndDate);
			}
		},

		onInputChangeAbsBeguz: function (oEvent) {
			if (oEvent.getParameter("value") !== "") {
				sap.ui.getCore().byId("ld_inp_duration_leave").setEditable(true);
			} else {
				sap.ui.getCore().byId("ld_inp_duration_leave").setEditable(false);
				sap.ui.getCore().byId("ld_inp_duration_leave").setValue();
			}
			this.onChangeDurationAbsence();
		},

		onOpenRptimeLog: function (aButtons, vUnitKey, oEvent) {

			var oButton = oEvent.getSource();
			var oModel = this.getView().getModel();

			var oRptimeLogPopover = new sap.m.Popover({
				beforeClose: function () {
					this.oRptimeLogOpen = false;
				}.bind(this),
				placement: "Auto"
			});

			var oCloseButton = new sap.m.Button({
				text: "X",
				tooltip: "{18n>close}",
				press: function () {
					if (sap.ui.getCore().byId("ld_select_attention")) {
						sap.ui.getCore().byId("ld_select_attention").destroy();
					}
					oRptimeLogPopover.close();
				}
			});

			oRptimeLogPopover.setBusyIndicatorDelay(0);
			oRptimeLogPopover.setBusy(true);

			var oMessageList = new sap.m.List({
				headerText: "{i18n>messages}"
			});

			oRptimeLogPopover.addContent(oMessageList);

			var oMsgItem = new sap.m.ObjectListItem({
				title: "{EmpName}",
				type: "Active",
				press: this.onOpenRptimeEmpLog.bind(this),
				intro: "{Message}"
			});

			if (this.oRptimeLogOpen === true) {
				this.oMessagePopover.close();
				if (oEvent.getSource() == this.oMsgSumSource) {
					return;
				}
			}

			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

			this.oMessagePopover = oRptimeLogPopover;

			oMessageList.setModel(oModel);
			oMessageList.bindAggregation("items", {
				template: oMsgItem,
				path: "/rptimeLogSet",
				filters: [oUnitFilter],
				events: {
					dataReceived: function (oData) {
						oRptimeLogPopover.setBusy(false);
						oRptimeLogPopover.setEndButton(oCloseButton);
					}
				}
			});

			this.oMessagePopover.openBy(oButton);
			this.oRptimeLogOpen = true;
		},

		onOpenRptimeEmpLog: function (oEvent) {
			var oModel = this.getView().getModel();
			var oSource = oEvent.getSource();
			var vRptimeEmpLogOpen;

			var oRptimeLogPopover = new sap.m.Popover({
				placement: "Left",
				beforeClose: function () {
					vRptimeEmpLogOpen = false;
				}.bind(this)
			});

			var oCloseButton = new sap.m.Button({
				text: "X",
				tooltip: "{18n>close}",
				press: function () {
					if (sap.ui.getCore().byId("ld_select_attention")) {
						sap.ui.getCore().byId("ld_select_attention").destroy();
					}
					oRptimeLogPopover.close();
				}
			});

			oRptimeLogPopover.setBusyIndicatorDelay(0);
			oRptimeLogPopover.setBusy(true);

			var oMessageList = new sap.m.List({
				headerText: "{i18n>messages}"
			});

			oRptimeLogPopover.addContent(oMessageList);

			var oMsgItem = new sap.m.ObjectListItem({
				// icon: "sap-icon://error",
				title: "{MessageText}",
				type: "Inactive",
				intro: {
					path: "Begda",
					formatter: function (oBegda) {
						var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
							pattern: "dd.MM.yyyy"
						});
						return oDateFormat.format(oBegda);
					}
				}
			});

			if (vRptimeEmpLogOpen === true) {
				this.oMessagePopover.close();
				if (oEvent.getSource() == this.oMsgSumSource) {
					return;
				}
			}

			var oCtx = oSource.getBindingContext();

			var vEmpId = oModel.getProperty("EmpId", oCtx);

			var oEmpFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);

			this.oMessagePopover = oRptimeLogPopover;

			oMessageList.setModel(oModel);

			oMessageList.bindAggregation("items", {
				template: oMsgItem,
				path: "/rptimeEmpLogSet",
				filters: [oEmpFilter],
				events: {
					dataReceived: function (oData) {
						oRptimeLogPopover.setBusy(false);
						oRptimeLogPopover.setEndButton(oCloseButton);
					}
				}
			});

			this.oMessagePopover.openBy(oSource);
			vRptimeEmpLogOpen = true;
		},

		onStartRptime: function (vUnitKey) {
			var oModel = this.getView().getModel();
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oBegda = sap.ui.getCore().byId("dp_begda");
			var oEndda = sap.ui.getCore().byId("dp_endda");

			var vBegda = oBegda.getDateValue();
			var vEndda = oEndda.getDateValue();

			var oEmpSel = sap.ui.getCore().byId("mcb_employees");
			var aSelEmps = oEmpSel.getSelectedKeys();
			var vEmpids = "";
			var vCurrentEmp;

			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vStarted = oResourceBundle.getText("rptimestarted");
			MessageToast.show(vStarted);

			for (var i = 0; i < aSelEmps.length; i++) { //yannick
				vCurrentEmp = aSelEmps[i];
				if (vEmpids) {
					vEmpids = vEmpids + ";" + vCurrentEmp;
				} else {
					vEmpids = vCurrentEmp;
				}

			}

			var oBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, vBegda);
			var oEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, vEndda);
			var oEmpIdsFilter = new sap.ui.model.Filter("EmpIds", sap.ui.model.FilterOperator.EQ, vEmpids);

			oModel.read("/rptimeSet", {
				filters: [oEmpIdsFilter, oBegdaFilter, oEnddaFilter, oUnitFilter],
				success: function () {
					this.onCloseRpTime();
					var oRptimeLogButton = sap.ui.getCore().byId("btn_rptimemsg_" + vUnitKey);

					this._oRptime.clearBuffer(vUnitKey);
					oRptimeLogButton.setType(sap.m.ButtonType.Unstyled);
					oRptimeLogButton.setText("");

					this.heartBeatTrigger = new sap.ui.core.IntervalTrigger(1);
					this.heartBeatTrigger.setInterval(3000);

					setTimeout(function () {
						this.heartBeatTrigger.addListener(function () {
							this.getRptimeDataInInterval(vUnitKey);
						}.bind(this));
					}.bind(this), 1000);
				}.bind(this),
				error: function (oError) {
					this.createError(oError);
				}.bind(this)
			});

		},

		getRptimeDataInInterval: function (vUnitKey, oEvent) {
			var oRptimeLogButton = sap.ui.getCore().byId("btn_rptimemsg_" + vUnitKey);

			this._oRptime.refreshBuffer(vUnitKey, oRptimeLogButton).then(function (oResult) {
				if (oResult.aItems[0]) {
					if (oResult.aItems[0].Amount > 0 || oResult.aItems[0].Finish === true) {
						if (oResult.aItems[0].Amount > 0) {
							oResult.oTemplate.setType(sap.m.ButtonType.Reject);
							oResult.oTemplate.setText(oResult.aItems[0].Amount);
							if (oEvent === "TimeOverview") {
								var oMessageList = sap.ui.getCore().byId("li_rp_to_msg");
								// oMessageList.refreshItems();
								oMessageList.getBinding("items").refresh(true);
								var oPanel = sap.ui.getCore().byId("pnl_rptime");
								oPanel.setBusy(false);
							}
						} else {
							oResult.oTemplate.setType(sap.m.ButtonType.Accept);
							oResult.oTemplate.setText("");
						}
						this.heartBeatTrigger.setInterval(0);
						MessageBox.information(this.getResourceBundleText("rptimesuccess"));
					} else {
						oResult.oTemplate.setType(sap.m.ButtonType.Unstyled);
						oResult.oTemplate.setText("");
					}
				}
			}.bind(this));
		},

		prepareRPTIME: function (vUnitKey) {
			if (!this._oRpTimeDialog) {
				this._oRpTimeDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.RpTime", this, {
					refreshAfterChange: true
				});
				this._oRpTimeDialog.attachAfterClose(this.destroyRpTimePopup.bind(this));
				this.getView().addDependent(this._oRpTimeDialog);
			}
			this._oRpTimeDialog.open();
			this._oRpTimeDialog.setBusyIndicatorDelay(0);
			this._oRpTimeDialog.setBusy(true);

			var dToday = new Date();

			var oTemplate = new sap.ui.core.Item({
				text: "{Name}",
				key: "{EmpId}"
			});

			var oEmpSelect = sap.ui.getCore().byId("mcb_employees");
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oPlanBegda = this.getSelectedBegda();
			var oPlanEndda = this.getSelectedEndda();

			var oDpBegda = sap.ui.getCore().byId("dp_begda");
			var oDpEndda = sap.ui.getCore().byId("dp_endda");

			oDpBegda.setDateValue(oPlanBegda);
			oDpEndda.setDateValue(oPlanEndda);

			oPlanBegda.setUTCDate(oPlanBegda.getDate());
			oPlanEndda.setUTCDate(oPlanEndda.getDate());
			var vPlanBegda = this.getFormattedDate(oPlanBegda);
			var vPlanEndda = this.getFormattedDate(oPlanEndda);
			var oLocalModel;
			var oYearModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/MIND2/PEP_YEAR_SRV", {
				refreshAfterChange: true
			});

			var oPlanBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, vPlanBegda);
			var oPlanEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, vPlanEndda);

			oYearModel.read("/EmployeeSet", {
				filters: [oUnitFilter, oPlanBegdaFilter, oPlanEnddaFilter],
				success: function (oData) {
					oLocalModel = this.prepareLocalEmployeeModel(oData);
					oEmpSelect.setModel(oLocalModel, "oLocalEmployeeModel");
					this._oRpTimeDialog.setBusy(false);
				}.bind(this)
			});

			var oButton = sap.ui.getCore().byId("btn_start_rptime");
			oButton.attachPress(this.onStartRptime.bind(this, vUnitKey));

		},

		prepareXLSDOWN: function (vUnitKey) {
			if (!this._oExcelDialog) {
				this._oExcelDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.PlanExcelCreate", this, {
					refreshAfterChange: true
				});
				this._oExcelDialog.attachAfterClose(this.destroyPlanExcelPopup.bind(this));
				this.getView().addDependent(this._oExcelDialog);
			}
			this._oExcelDialog.open();
			this._oExcelDialog.setBusyIndicatorDelay(0);

			var oBegda = this.getSelectedBegda();
			var vFirstDay = new Date(oBegda.getFullYear(), oBegda.getMonth(), 1); //first day of current month
			var vLastDay = new Date(vFirstDay.getFullYear() + 1, vFirstDay.getMonth(), 0); // + 12 months

			var oBegda = sap.ui.getCore().byId("dp_excel_begda");
			var oEndda = sap.ui.getCore().byId("dp_excel_endda");

			oBegda.setDateValue(vFirstDay);
			oEndda.setDateValue(vLastDay);

			var oButton = sap.ui.getCore().byId("btn_download_excel");
			oButton.attachPress(this.downloadExcel.bind(this, vUnitKey));

		},

		//22.02.2021 Mitarbeiter Excel Button/Dialog
		prepareEMP_EXCEL: function (vUnitKey) {
			if (!this._oEmpExcelDialog) {
				this._oEmpExcelDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.PlanEmpExcelCreate", this, {
					refreshAfterChange: true
				});
				this._oEmpExcelDialog.attachAfterClose(this.destroyPlanEmpExcelPopup.bind(this));
				this.getView().addDependent(this._oEmpExcelDialog);
			}
			this._oEmpExcelDialog.open();
			this._oEmpExcelDialog.setBusyIndicatorDelay(0);

			var oBegda = this.getSelectedBegda();
			var oDate = sap.ui.getCore().byId("dp_emp_excel_date");

			oDate.setDateValue(oBegda);

			var oButton = sap.ui.getCore().byId("btn_download_emp_excel");
			oButton.attachPress(this.downloadEmpExcel.bind(this, vUnitKey));

		},

		prepareTO_MAIN: function (vIUnitKey) {
			var vDate;
			var vEmpID;
			var vUnitKey;

			vDate = null;
			vUnitKey = vIUnitKey;

			if (vEmpID) {
				this.getView().getModel().callFunction("/CheckEmployeeLocked", {
					method: "GET",
					urlParameters: {
						"empId": vEmpID,
						"planBegda": this.getSelectedBegda(),
						"planEndda": this.getSelectedEndda()
					},
					success: function () {
						this.openTimeOverviewPopup(vDate, vUnitKey, vEmpID);
					}.bind(this),
					error: function (oError) {
						var aErrorMsg = JSON.parse(oError.responseText).error.innererror.errordetails;
						Helper.openConfirmDialog("{i18n>warning}", aErrorMsg[0].message, "{i18n>openanyway}", function () {
								this.openTimeOverviewPopup(vDate, vUnitKey, vEmpID);
							}.bind(this),
							null, this);
					}.bind(this)
				});
			} else {
				this.openTimeOverviewPopup(vDate, vUnitKey, vEmpID);
			}
		},

		//23.03.2021 Dienstplan-Formulare PDF Button/Dialog Anna
		prepareROSTER: function () {
			var oFragmentController = new FragmentExportRosterPDF(this);

			if (!this._oRosterDialog) {
				this._oRosterDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.ExportRosterPDF", oFragmentController, {
					refreshAfterChange: true
				});
				this._oRosterDialog.attachAfterClose(this.destroyRosterPopup.bind(this));
				this.getView().addDependent(this._oRosterDialog);
			}
			this._oRosterDialog.open();
			this._oRosterDialog.setBusyIndicatorDelay(0);

			// var oBegda = this.getSelectedBegda();
			// var oDate = sap.ui.getCore().byId("dp_emp_excel_date");

			// oDate.setDateValue(oBegda);

			// var oButton = sap.ui.getCore().byId("btn_download_emp_excel");
			// oButton.attachPress(this.downloadEmpExcel.bind(this, vUnitKey));

		},

		// onOpenSharepointExcelPopup: function (vUnitKey) {
		// 	if (!this._oExcelDialog) {
		// 		this._oExcelDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.PlanExcelCreate", this, {
		// 			refreshAfterChange: true
		// 		});
		// 		this._oExcelDialog.attachAfterClose(this.destroyPlanExcelPopup.bind(this));
		// 		this.getView().addDependent(this._oExcelDialog);
		// 		sap.ui.getCore().byId("btn_download_excel").setText(this.getResourceBundleText("sendtosharepointbtn"));
		// 	}
		// 	this._oExcelDialog.open();
		// 	this._oExcelDialog.setBusyIndicatorDelay(0);

		// 	var vFirstDay = new Date(new Date().getFullYear(), 0, 1);
		// 	var vLastDay = new Date(new Date().getFullYear(), 11, 31);

		// 	var oBegda = sap.ui.getCore().byId("dp_excel_begda");
		// 	var oEndda = sap.ui.getCore().byId("dp_excel_endda");

		// 	oBegda.setDateValue(vFirstDay);
		// 	oEndda.setDateValue(vLastDay);

		// 	var oButton = sap.ui.getCore().byId("btn_download_excel");
		// 	oButton.attachPress(this.onPressSharepointButton.bind(this, vUnitKey));

		// },

		prepareTIMSTAT: function (vUnitKey) {
			if (!this._oTimStatDialog) {
				this._oTimStatDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.FormTimeStatementCreate", this, {
					refreshAfterChange: true
				});
				this._oTimStatDialog.attachAfterClose(this.destroyTimeStatementForm.bind(this));
				this.getView().addDependent(this._oTimStatDialog);
				var oViewModel = this.getOwnerComponent().getModel("TimStatView");
				if (oViewModel.getProperty("/selectedA") === undefined &&
					oViewModel.getProperty("/selectedB") === undefined) {
					oViewModel.setProperty("/selectedA", true);
					oViewModel.setProperty("/selectedB", false);
				}
				this._oTimStatDialog.setModel(oViewModel);
			}
			this._oTimStatDialog.open();
			this._oTimStatDialog.setBusyIndicatorDelay(0);
			this._oTimStatDialog.setBusy(true);

			var oMonthPicker = sap.ui.getCore().byId("mp_timeSlipMonth");
			var oYearPicker = sap.ui.getCore().byId("yp_timeSlipYear");
			var dToday = new Date();
			oMonthPicker.setMonth(dToday.getMonth());
			oYearPicker.setDate(new Date());

			var oTemplate = new sap.ui.core.Item({
				text: "{Name}",
				key: "{EmpId}"
			});

			var oEmpSelect = sap.ui.getCore().byId("mcb_employees");
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oPlanBegda = this.getSelectedBegda();
			var oPlanEndda = this.getSelectedEndda();
			oPlanBegda.setUTCDate(oPlanBegda.getDate());
			oPlanEndda.setUTCDate(oPlanEndda.getDate());
			var vPlanBegda = this.getFormattedDate(oPlanBegda);
			var vPlanEndda = this.getFormattedDate(oPlanEndda);
			var oLocalModel;
			var oYearModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/MIND2/PEP_YEAR_SRV", {
				refreshAfterChange: true
			});

			var oPlanBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, vPlanBegda);
			var oPlanEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, vPlanEndda);

			oYearModel.read("/EmployeeSet", {
				filters: [oUnitFilter, oPlanBegdaFilter, oPlanEnddaFilter],
				success: function (oData) {
					oLocalModel = this.prepareLocalEmployeeModel(oData);
					oEmpSelect.setModel(oLocalModel, "oLocalEmployeeModel");
					this._oTimStatDialog.setBusy(false);
				}.bind(this)
			});

			var oButton = sap.ui.getCore().byId("btn_download_timstat_pdf");
			oButton.attachPress(this.downloadTimeStatementPDF.bind(this, vUnitKey, oViewModel));

		},

		prepareLocalEmployeeModel: function (oData) {
			var oLocalModel = new sap.ui.model.json.JSONModel();
			var aData = oData.results;
			var mModelData = {
				employees: []
			};

			for (var i = 0; i < aData.length; i++) {
				var mEmployeeData = {};
				mEmployeeData.EmpId = aData[i].EmpId;
				mEmployeeData.EmpName = aData[i].Name;
				mModelData.employees.push(mEmployeeData);
			}

			oLocalModel.setData(mModelData);

			oLocalModel.oData.employees.unshift({
				"EmpId": "All",
				"EmpName": this.getResourceBundleText("selectall")
			});

			return oLocalModel;
		},

		onTsEmpChange: function (oEvent) {
			var changedItem = oEvent.getParameter("changedItem");
			var isSelected = oEvent.getParameter("selected");
			var vState = "Selected";

			if (!isSelected) {
				vState = "Deselected";
			}

			//Check if Selected All is selected
			if (changedItem.mProperties.key === "All") {
				var oName, res;

				//If it is Selected
				if (vState === "Selected") {

					var oItems = oEvent.oSource.mAggregations.items;
					for (var i = 0; i < oItems.length; i++) {
						if (i === 0) {
							oName = oItems[i].mProperties.key;
						} else {
							oName = oName + ',' + oItems[i].mProperties.key;
						}
					}

					res = oName.split(",");
					oEvent.oSource.setSelectedKeys(res);

				} else {
					res = null;
					oEvent.oSource.setSelectedKeys(res);
				}
			}
		},

		downloadTimeStatementPDF: function (vUnitKey, oDateModel) {
			var oMonthPicker = sap.ui.getCore().byId("mp_timeSlipMonth");
			var oYearPicker = sap.ui.getCore().byId("yp_timeSlipYear");
			var oEmpSel = sap.ui.getCore().byId("mcb_employees");
			var oDateFormatter = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "yyyyMMdd"
			});
			var oBegda;
			var oEndda;

			var aSelEmps = oEmpSel.getSelectedKeys();
			var vEmpids = "";
			var vEncryptedEmpId = "";

			if (oDateModel.getProperty("/selectedB") === true) {
				oBegda = oDateFormatter.format(sap.ui.getCore().byId("dp_timestat_begda").getDateValue());
				oEndda = oDateFormatter.format(sap.ui.getCore().byId("dp_timestat_endda").getDateValue());
			} else {
				oBegda = oDateFormatter.format(new Date(oYearPicker.getDate().getFullYear(), oMonthPicker.getMonth(), 1));
				oEndda = oDateFormatter.format(new Date(oYearPicker.getDate().getFullYear(), oMonthPicker.getMonth() + 1, 0));
			}

			if (oBegda && oEndda && aSelEmps.length > 0) {
				for (var i = 0; i < aSelEmps.length; i++) {
					if (vEncryptedEmpId) {
						vEncryptedEmpId = aSelEmps[i];
						if (vEncryptedEmpId === "All") {
							continue;
						}
						vEncryptedEmpId = this.encryptEmployeeId(aSelEmps[i]);
						vEmpids = vEmpids + "F" + vEncryptedEmpId;
					} else {
						vEncryptedEmpId = aSelEmps[i];
						if (vEncryptedEmpId === "All") {
							vEncryptedEmpId = "";
							continue;
						}
						vEncryptedEmpId = this.encryptEmployeeId(aSelEmps[i]);
						vEmpids = vEmpids + vEncryptedEmpId;
					}
				}

				var oPdfURL = "/timStatSet(UK='" + vUnitKey + "',EI='" + vEmpids + "',Begda='" + oBegda + "',Endda='" +
					oEndda +
					"')/$value";
				oPdfURL = "/sap/opu/odata/MIND2/PEP_PLANNER_SRV" + oPdfURL;

				window.open(oPdfURL, "_blank");

				this._oTimStatDialog.close();
				this._oTimStatDialog.destroy();
				this._oTimStatDialog = null;
			}

		},

		destroyTimeStatementForm: function () {
			this._oTimStatDialog.destroy();
			this._oTimStatDialog = null;
		},

		destroyPlanExcelPopup: function (oEvent) {
			this._oExcelDialog.destroy();
			this._oExcelDialog = null;
		},

		destroyPlanEmpExcelPopup: function (oEvent) {
			this._oEmpExcelDialog.destroy();
			this._oEmpExcelDialog = null;
		},

		destroyRosterPopup: function (oEvent) {
			this._oRosterDialog.destroy();
			this._oRosterDialog = null;
		},

		destroyRpTimePopup: function (oEvent) {
			this._oRpTimeDialog.destroy();
			this._oRpTimeDialog = null;
		},

		onCloseTimeStatementForm: function () {
			this._oTimStatDialog.close();
		},

		onCloseYearExcelPopup: function (oEvent) {
			this._oExcelDialog.close();
		},

		onCloseEmpExcelPopup: function (oEvent) {
			this._oEmpExcelDialog.close();
		},

		onCloseRosterDialog: function (oEvent) {
			this._oRosterDialog.close();
		},

		onCloseRpTime: function (oEvent) {
			this._oRpTimeDialog.close();
		},

		encryptEmployeeId: function (vEmpId) {
			var vEncryptedEmpId = vEmpId * 3 + 2;
			return vEncryptedEmpId;
		},

		onInputChange: function (oEvent) {
			var oElementID = oEvent.getParameter("id");
			sap.ui.getCore().byId(oElementID).setValueState(sap.ui.core.ValueState.None);
		},

		onInputChangeShift: function (oEvent) {
			this.onInputChange(oEvent);
			this.ShiftDirty = true;
		},

		onInputChangeAllowAmount: function () {

		},

		onInputChangeAllowHours: function () {

		},

		onInputChangeCico: function (oEvent) {
			this.onInputChange(oEvent);
			this.CicoDirty = true;
		},

		onInputChangeAbs: function (oEvent) {
			this.onInputChange(oEvent);
			this.AbsDirty = true;
		},

		onInputChangeAbsFreeDays: function (oEvent) {
			this.onInputChange(oEvent);
			this.AbsDirty = true;
			if (oEvent.getParameter("selected") === true) {
				// sap.ui.getCore().byId("l_weekly_everyxweeks").setVisible(false);
				// sap.ui.getCore().byId("inp_weekly_everyxweeks").setVisible(false);
				// sap.ui.getCore().byId("inp_weekly_everyxweeks").setValue(1);
			} else {
				// sap.ui.getCore().byId("l_weekly_everyxweeks").setVisible(true);
				// sap.ui.getCore().byId("inp_weekly_everyxweeks").setVisible(true);
			}
		},

		onInputChangeOvertime: function (oEvent) {
			this.onInputChange(oEvent);
			this.OvertimeDirty = true;
		},

		onOvertimeInputChange: function (oEvent) {

			var oElementID = oEvent.getParameter("id");
			sap.ui.getCore().byId(oElementID).setValueState(sap.ui.core.ValueState.None);
			this.fillOvertimeTable();
		},

		onLeaveInputChange: function (oEvent) {
			var oElementID = oEvent.getParameter("id");
			sap.ui.getCore().byId(oElementID).setValueState(sap.ui.core.ValueState.None);
			this.fillLeaveTable();
		},

		onNewAllowanceSelect: function (oEvent) {
			var oItem = oEvent.getParameter();
			var oSysModel = oEvent.getSource().getModel("AllowanceModel");

			oSysModel.setProperty("/Allowance", oItem);
			this.AllowDirty = true;
		},

		onCicoDirty: function () {
			this.CicoDirty = true;
		},

		onOvertimeDirty: function () {
			var oCommentSelect = sap.ui.getCore().byId("ld_select_comment_overtime");
			var oCommentInput = sap.ui.getCore().byId("ld_inp_comment_overtime");
			oCommentInput.setRequired(oCommentSelect.getSelectedKey() == 'SONST');
			this.OvertimeDirty = true;
		},

		downloadPDF: function (vUnitKey, bValid) {
			var oDP = sap.ui.getCore().byId("dp_form_begda");
			var oBegda = oDP.getDateValue();
			var oRadioBtnGroup = sap.ui.getCore().byId("rbg_timeFrame");
			var oRadioButton = oRadioBtnGroup.getSelectedButton();
			var oDataModel = this._oPrintFormDialog.getModel("FormDownloadModel");
			var vNumWeeks = oDataModel.getProperty("/RadioIndex") === 3 && oDataModel.getProperty("/CustomWeekCount") || Helper.getCustomDataValue(
				oRadioButton.getCustomData(), "weeks");
			var oEndda = new Date(oBegda);
			for (var k = 0; k < vNumWeeks; k++) {
				oEndda.setDate(oEndda.getDate() + 7);
			}
			Date.prototype.toJSONLocal = function () {
				function addZ(n) {
					return (n < 10 ? 0 : "") + n;
				}
				return this.getFullYear() + "-" +
					addZ(this.getMonth() + 1) + "-" +
					addZ(this.getDate()) + "T12:00:00";
			};
			if (bValid !== true) {
				this.checkOpenMsgBeforeExport(oBegda, oEndda, "downloadPDF", vUnitKey);
				return;
			}

			var oPdfURL = "/formSet(UnitKey='" + vUnitKey + "',NumWeeks=" + vNumWeeks +
				",Begda=datetime'" + oBegda.toJSONLocal() + "')/$value ";
			oPdfURL = "/sap/opu/odata/MIND2/PEP_PLANNER_SRV" + oPdfURL;
			window.open(oPdfURL, "_blank");
			this._oPrintFormDialog.close();
			this._oPrintFormDialog.destroy();
			this._oPrintFormDialog = null;
		},

		prepareHIDE: function (vUnitKey) {
			if (!this._oHideDialog) {
				this._oHideDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.HideShowColumns", this);
				this._oHideDialog.attachAfterClose(this.destroyHideShowColumns.bind(this));
				this.getView().addDependent(this._oHideDialog);
				this._oHideDialog.addCustomData(new sap.ui.core.CustomData({
					key: "UnitKey",
					// writeToDom: true,
					value: vUnitKey
				}));
				this._oHideDialog.setBusyIndicatorDelay(0);
				this._oHideDialog.setBusy(true);
			}
			var oModel = this.getView().getModel();
			var vVariant = 0;
			// var oUnitFilterEQ = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			if (this.isFeatureEnabled("VARIANT")) {
				var oSFVariant = sap.ui.getCore().byId("sf_buildVariant");
				oSFVariant.setVisible(true);
				var oSelVariant = sap.ui.getCore().byId("ld_select_variant");

				var oTemplateVariants = new sap.ui.core.Item({
					text: "{VariantName}",
					key: "{Variant}"
				});

				oSelVariant.setModel(oModel);
				oSelVariant.bindAggregation("items", {
					path: "/colVariantSet",
					// filters: [oUnitFilterEQ],
					template: oTemplateVariants,
					events: {
						dataReceived: function () {
							for (var i = 0; i < oSelVariant.getAggregation("items").length; i++) {
								if (oSelVariant.getItems()[i].getBindingContext().getProperty("IsActive")) {
									oSelVariant.setSelectedIndex(i);
									vVariant = oSelVariant.getSelectedKey();
									break;
								}
							}
							this.updateHideShowPopup(vUnitKey, vVariant);
						}.bind(this)
					}
				});

				if (this.isFeatureEnabled("VARIANTEMP")) {
					var oMCB = sap.ui.getCore().byId('idSelectEmployees'),
						oBind = oMCB.getBinding('items'),
						dStart = this.getView().getModel('Customizing').getProperty('/StartDate'),
						dEnd = this.getView().getModel('Customizing').getProperty('/EndDate');

					var aFilters = [
						new sap.ui.model.Filter("UnitKey", "EQ", vUnitKey),
						new sap.ui.model.Filter("Begda", "EQ", dStart),
						new sap.ui.model.Filter("Endda", "EQ", dEnd)
					];

					oBind.filter(aFilters, "Application");
				}

			} else {
				this.updateHideShowPopup(vUnitKey, vVariant);
			}

			// if (this.isFeatureEnabled("SHAREPOINT")) {
			//sap.ui.getCore().byId("cb_useForExcel").setVisible(true);
			// }

			var oAddButton = sap.ui.getCore().byId("btn_newVariant");
			oAddButton.attachPress(this.onSaveVariant.bind(this, vUnitKey));

			var oDelButton = sap.ui.getCore().byId("btn_del_variant");
			oDelButton.attachPress(this.onDeleteVariant.bind(this, vUnitKey));

			var oButton = sap.ui.getCore().byId("btn_show_hide_save");
			oButton.attachPress(this.onShowHideSave.bind(this, vUnitKey));
			this._oHideDialog.open();
		},

		onMassSelection: function () {
			var oMCB = sap.ui.getCore().byId('idSelectEmployees');

			if (oMCB.getSelectedKeys().length === oMCB.getItems().length) {
				oMCB.clearSelection();
				oMCB.removeAllSelectedItem();
			} else {
				oMCB.setSelectedKeys(oMCB.getKeys());
			}

			oMCB.fireSelectionChange();
		},

		onEmployeeSelChange: function (oEvent) {
			var oSrc = oEvent.getSource(),
				oButton = sap.ui.getCore().byId('selectAllEmployees');

			if (oSrc.getItems().length !== oSrc.getSelectedItems().length) {
				oButton.setIcon("sap-icon://accept");
			} else {
				oButton.setIcon("sap-icon://decline");
			}
		},

		onNewVariantSelect: function (oEvent) {
			var oCustomData = this._oHideDialog.getCustomData();
			var vUnitKey = Helper.getCustomDataValue(oCustomData, "UnitKey");
			var vVariant = this.getView().getModel().getProperty("Variant", oEvent.getParameter("selectedItem").getBindingContext());

			this.updateHideShowPopup(vUnitKey, vVariant);

		},

		updateHideShowPopup: function (vUnitKey, vVariant) {
			var oModel = this.getView().getModel();
			var oUnitFilterEQ = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oVariantFilterEQ = new sap.ui.model.Filter("Variant", sap.ui.model.FilterOperator.EQ, vVariant);
			var oVBox = sap.ui.getCore().byId("vb_hide_cols");
			var oTemplate = new sap.m.CheckBox({
				text: "{ColText}",
				selected: "{IsActive}"
			});
			//to enable individual views for excel generation
			//var oSelVariant = sap.ui.getCore().byId("ld_select_variant");
			//var oCBForExcel = sap.ui.getCore().byId("cb_useForExcel");

			//oCBForExcel.setSelected(oSelVariant.getModel().getProperty("ForExcel", oSelVariant.getSelectedItem().getBindingContext()));

			oVBox.setModel(oModel);
			oVBox.bindAggregation("items", {
				path: "/mycolSet",
				filters: [oUnitFilterEQ, oVariantFilterEQ],
				template: oTemplate,
				events: {
					dataReceived: function () {
						this._oHideDialog.setBusy(false);
					}.bind(this)
				}
			});

			if (this.isFeatureEnabled("VARIANTEMP")) {
				var oBind = sap.ui.getCore().byId('idSelectEmployees').getBinding('items');
				var oDR = function (oEvent) {
					var arr = oEvent.getSource().getContexts();
					var aSel = [];
					arr.forEach(function (item) {
						if (item.getProperty("IsVisible")) aSel.push(item.getProperty("EmpId"));
					});
					sap.ui.getCore().byId('idSelectEmployees').setSelectedKeys(aSel);
					sap.ui.getCore().byId('idSelectEmployees').fireSelectionChange();
					oBind.detachChange(oDR);
				};
				oBind.attachChange(oDR);
				oBind.filter(oVariantFilterEQ);
				if (oBind.isSuspended()) oBind.resume();
			}

		},

		prepareSELDROP: function (vUnitKey) {
			if (!this._oSelectDropdown) {
				this._oSelectDropdown = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.SelectDropdowns", this);
				this._oSelectDropdown.attachAfterClose(this.destroySelectDropdown.bind(this));
				this.getView().addDependent(this._oSelectDropdown);
				this._oSelectDropdown.setBusyIndicatorDelay(0);
				this._oSelectDropdown.setBusy(true);
			}
			var oModel = this.getView().getModel();
			var oButton = sap.ui.getCore().byId("btn_select_dropdown_save");
			var oUnitFilterEQ = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oModel = this.getView().getModel();
			var oSelect = sap.ui.getCore().byId("sel_ddtype");
			var oVBox = sap.ui.getCore().byId("vb_select_dropdown");
			var oSelTemplate = new sap.ui.core.Item({
				text: "{Description}",
				key: "{KeyValue}"
			});
			var oTemplate = new sap.m.CheckBox({
				text: "{ItemText}",
				selected: "{Selected}"
			});

			oButton.attachPress(this.onSelectDropdownSave.bind(this, vUnitKey));
			oSelect.setModel(oModel);
			oSelect.bindItems({
				path: "/ddSelectSet",
				template: oSelTemplate,
				filters: [oUnitFilterEQ],
				events: {
					dataReceived: function (oEvent) {
						var oObj = oEvent.getSource().getModel().getProperty(oEvent.getSource().getContexts()[0].getPath());
						var vDDType = oObj.KeyValue;
						var oDDTypeFilter = new sap.ui.model.Filter("DropKey", sap.ui.model.FilterOperator.EQ, vDDType);
						oVBox.setModel(oModel);
						oVBox.bindAggregation(
							"items", {
								path: "/selectDropdownSet",
								filters: [oUnitFilterEQ, oDDTypeFilter],
								template: oTemplate,
								events: {
									dataReceived: function () {
										this._oSelectDropdown.setBusy(false);
									}.bind(this)
								}
							});
					}.bind(this)
				}
			});

			this._oSelectDropdown.open();
		},

		onDDTypeChange: function (oEvent) {
			var oModel = this.getView().getModel();
			var oObject = oEvent.getSource().getModel().getObject(oEvent.getSource().getSelectedItem().getBindingContext().getPath());
			var vDropKey = oObject.KeyValue;
			var vUnitKey = oObject.UnitKey;
			var oVBox = sap.ui.getCore().byId("vb_select_dropdown");
			var oUnitFilterEQ = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oDropKeyFilter = new sap.ui.model.Filter("DropKey", sap.ui.model.FilterOperator.EQ, vDropKey);
			var oTemplate = new sap.m.CheckBox({
				text: "{ItemText}",
				selected: "{Selected}"
			});

			oVBox.setModel(oModel);

			oVBox.bindAggregation("items", {
				path: "/selectDropdownSet",
				filters: [oUnitFilterEQ, oDropKeyFilter],
				template: oTemplate,
				events: {
					dataReceived: function () {
						this._oSelectDropdown.setBusy(false);
					}.bind(this)
				}
			});
		},

		selectDeselectAllHideShow: function (oEvent) {
			var oVBox = sap.ui.getCore().byId("vb_hide_cols");
			var aCB = [];
			aCB = oVBox.getAggregation("items");

			var vSelect = oEvent.getSource().getSelected();
			var oItem = {};

			if (vSelect) {
				for (var i = 0; i < aCB.length; i++) {
					oItem = aCB[i];
					oItem.setSelected(true);
				}
			} else {
				for (var i = 0; i < aCB.length; i++) {
					oItem = aCB[i];
					oItem.setSelected(false);
				}
			}
		},

		selectDeselectAllNewsletter: function (oEvent) {
			var oVBox = sap.ui.getCore().byId("vb_mails");
			var aCB = [];
			aCB = oVBox.getAggregation("items");

			var vSelect = oEvent.getSource().getSelected();
			var oItem = {};

			if (vSelect) {
				for (var i = 0; i < aCB.length; i++) {
					oItem = aCB[i];
					oItem.setSelected(true);
				}
			} else {
				for (var i = 0; i < aCB.length; i++) {
					oItem = aCB[i];
					oItem.setSelected(false);
				}
			}
		},

		selectDeselectAllSelectDropdown: function (oEvent) {
			var oVBox = sap.ui.getCore().byId("vb_select_dropdown");
			var aCB = [];
			aCB = oVBox.getAggregation("items");

			var vSelect = oEvent.getSource().getSelected();
			var oItem = {};

			if (vSelect) {
				for (var i = 0; i < aCB.length; i++) {
					oItem = aCB[i];
					oItem.setSelected(true);
				}
			} else {
				for (var i = 0; i < aCB.length; i++) {
					oItem = aCB[i];
					oItem.setSelected(false);
				}
			}
		},

		onSaveVariant: function (vUnitKey) {
			var oModel = this.getView().getModel();
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var oVariantName = sap.ui.getCore().byId("ld_inp_newVariant");
			var vVariantName = oVariantName.getValue();
			oVariantName.setValueState(sap.ui.core.ValueState.None);

			if (!vVariantName) {
				oVariantName.setValueState(sap.ui.core.ValueState.Error);
				var vNoName = oResourceBundle.getText("nonameforvariant");
				MessageToast.show(vNoName);
			} else {
				var oObject = {};

				oObject.VariantName = vVariantName;
				oModel.create("/colVariantSet", oObject, {
					success: function (oData) {
						this.onUpdateHideShowSelect(vUnitKey, oData);
					}.bind(this)
				});
				oVariantName.setValue("");

				var vCreated = oResourceBundle.getText("variantcreated");
				MessageToast.show(vCreated);

			}

		},

		onDeleteVariant: function (vUnitKey, oEvent) {
			var oModel = this.getView().getModel();
			var oVariantName = sap.ui.getCore().byId("ld_select_variant");
			var vVariant = oVariantName.getSelectedItem().getKey();
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vDeletedMessage;

			var vPath = "/colVariantSet(" + vVariant + ")";
			oModel.remove(vPath, {
				success: function () {
					var oData;
					this.onUpdateHideShowSelect(vUnitKey, oData);
				}.bind(this)
			});

			if (vVariant == 0) {
				vDeletedMessage = oResourceBundle.getText("variantnotdeleted");
			} else {
				vDeletedMessage = oResourceBundle.getText("variantdeleted");
			}

			MessageToast.show(vDeletedMessage);
		},

		onUpdateHideShowSelect: function (vUnitKey, oData) {
			var oModel = this.getView().getModel();
			var oSelVariant = sap.ui.getCore().byId("ld_select_variant");
			var oTemplateVariants = new sap.ui.core.Item({
				text: "{VariantName}",
				key: "{Variant}"
			});

			oSelVariant.setModel(oModel);

			oSelVariant.bindAggregation("items", {
				path: "/colVariantSet",
				template: oTemplateVariants,
				events: {
					dataReceived: function () {
						var vVariant;
						if (oData) {
							vVariant = oData.Variant;
						} else {
							vVariant = 0;
						}
						oSelVariant.setSelectedKey(vVariant);
						this.updateHideShowPopup(vUnitKey, vVariant);
					}.bind(this)
				}
			});
		},

		destroyHideShowColumns: function () {
			this._oHideDialog.destroy();
			this._oHideDialog = null;
		},

		onCloseHideShow: function () {
			this._oHideDialog.close();
		},

		onCloseSelectDropdown: function () {
			this._oSelectDropdown.close();
		},

		destroySelectDropdown: function () {
			this._oSelectDropdown.destroy();
			this._oSelectDropdown = null;
		},

		preparePOOL: function (vUnitKey) {
			var oTable;
			if (!this._oAddPoolDialog) {
				this._oAddPoolDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.PoolEmployee", this);
				this._oAddPoolDialog.attachAfterClose(this.destroyAddPoolEmployee.bind(this));
				this.getView().addDependent(this._oAddPoolDialog);
				oTable = sap.ui.getCore().byId("tbl_pool_emps");
				oTable.setBusyIndicatorDelay(0);
				sap.ui.getCore().byId("btn_emp_add_pool").attachPress(this.addPoolEmp.bind(this, vUnitKey));
			}
			var oModel = this.getView().getModel();
			var oCalendar = sap.ui.getCore().byId("cal_date_int_pool").setMinDate(this.getSelectedBegda()).setMaxDate(this.getSelectedEndda());
			oCalendar.removeCustomData("UnitKey");
			oCalendar.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));
			var oDateRange = new sap.ui.unified.DateRange();
			var oSelect = sap.ui.getCore().byId("select_pool_quals");
			if (this.oCustomizing.PlanHideQKey) {
				var oTemplate = new sap.ui.core.Item({
					text: "{QualText}",
					key: "{QualId}"
				});
			} else {
				var oTemplate = new sap.ui.core.Item({
					text: "{QualId} - {QualText}",
					key: "{QualId}"
				});
			}

			oSelect.destroyItems();
			var oUnitFilterEQ = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

			oSelect.setModel(oModel);
			oSelect.bindAggregation("items", {
				path: "/qualificationSet",
				filters: [oUnitFilterEQ],
				template: oTemplate
			});

			var oBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.BT, this.getSelectedBegda(), this.getSelectedEndda());
			oTable.setModel(oModel);
			oTable.bindAggregation("rows", {
				path: "/poolEmpSet",
				filters: [oUnitFilterEQ, oBegdaFilter],
				events: {
					dataRequested: function () {
						oTable.setBusy(true);
					},
					dataReceived: function () {
						oTable.setBusy(false);
					}
				}
			});

			oDateRange.setStartDate(this.getSelectedBegda());
			oDateRange.setEndDate(this.getSelectedEndda());
			oCalendar.insertSelectedDate(oDateRange);

			this._oAddPoolDialog.open();

		},

		onPoolDelete: function (oEvent) {
			var vEmpId = this.getView().getModel().getProperty("EmpId", oEvent.getParameter("row").getBindingContext());
			var vUnitKey = this.getView().getModel().getProperty("UnitKey", oEvent.getParameter("row").getBindingContext());
			var vPath = "/poolEmpSet(EmpId='" + vEmpId + "',UnitKey='" + vUnitKey + "')";
			var oModel = this.getView().getModel();
			this.getView().getModel().remove(vPath, {
				success: function () {
					var oUnitFilterEQ = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
					var oBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.BT, this.getSelectedBegda(), this.getSelectedEndda());
					var oTable = sap.ui.getCore().byId("tbl_pool_emps");
					oTable.setModel(oModel);
					oTable.bindAggregation("rows", {
						path: '/poolEmpSet',
						filters: [oUnitFilterEQ, oBegdaFilter],
						events: {
							dataRequested: function () {
								oTable.setBusy(true);
							},
							dataReceived: function () {
								oTable.setBusy(false);
							}
						}
					});
				}.bind(this)
			});
		},

		addPoolEmp: function (vUnitKey) {
			var vName = sap.ui.getCore().byId("inp_pool").getValue();
			var oModel = this.getView().getModel();
			var oBegda = this.getSelectedBegda("cal_date_int_pool");
			var oEndda = this.getSelectedEndda("cal_date_int_pool");
			if (vName == "" || vName == undefined) {
				sap.ui.getCore().byId("inp_pool").setValueState("Error");
			} else if (!oBegda && !oEndda) {
				MessageBox.error(this.getResourceBundleText("begdaenddamissing"));
			} else {
				var vQual = sap.ui.getCore().byId("select_pool_quals").getSelectedKey();
				this.checkSuccessPool("99999999999", vUnitKey, oBegda, oEndda, vQual, vName);

				var oTable = sap.ui.getCore().byId("tbl_pool_emps");
				var oUnitFilterEQ = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
				var oBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.BT, this.getSelectedBegda(), this.getSelectedEndda());

				oTable.setModel(oModel);

				oTable.bindAggregation("rows", {
					path: "/poolEmpSet",
					filters: [oUnitFilterEQ, oBegdaFilter],
					events: {
						dataRequested: function () {
							oTable.setBusy(true);
						},
						dataReceived: function () {
							oTable.setBusy(false);
						}
					}
				});
			}
		},

		destroyAddPoolEmployee: function () {
			this._oAddPoolDialog.destroy();
			this._oAddPoolDialog = null;
		},

		closeAddPoolEmployee: function () {
			this._oAddPoolDialog.close();
		},

		onOpenDiscardChangesPopup: function (vUnitKey) {
			var oDialog = new Dialog({
				title: "{i18n>discardchangestitle}",
				content: new sap.m.Text({
					text: "{i18n>discardchanges}"
				}),
				beginButton: new Button({
					type: "Reject",
					text: "{i18n>discard}",
					press: function () {
						// var aCustomData = oDialog.getAggregation("customData");
						// vUnitKey = Helper.getCustomDataValue(aCustomData, "UnitKey");
						this.discardUnsavedChanges(vUnitKey);
						this._oUnsavedChangesDialog.close();
					}.bind(this)
				}),
				endButton: new Button({
					text: "{i18n>txtcancel}",
					press: function () {
						this._oUnsavedChangesDialog.close();
					}.bind(this)
				})
			});

			oDialog.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));

			if (!this._oUnsavedChangesDialog) {
				this._oUnsavedChangesDialog = oDialog;
				this._oUnsavedChangesDialog.attachAfterClose(this.destroyUnsavedChangesDialog.bind(this));
				this.getView().addDependent(this._oUnsavedChangesDialog);
			}

			this._oUnsavedChangesDialog.open();
		},

		destroyUnsavedChangesDialog: function () {
			this._oUnsavedChangesDialog.destroy();
			this._oUnsavedChangesDialog = null;
		},

		discardUnsavedChanges: function (vUnitKey) {
			//Prüfen ob das Model für die Dropdown-Werte in der Planung Werte enthält. 
			//Wenn ja, muss eine Abfrage stattfinden: "Wollen Sie die Änderungen verwerfen?" -> Wenn ja, müssen die Änderungen aus dem Model entfernt werden
			// if (this.getView().getModel("CBData")) {
			var oCBDataModel = this.getView().getModel("CBData");
			var vDataUnitKey;
			var iSplicePos = 0;
			var iEntries = oCBDataModel.getData().length;
			// 	for (var i = 0; i < oCBDataModel.getData().length; i++) {
			// 		vDataUnitKey = oCBDataModel.getData()[i].UnitKey;
			// 		if (vDataUnitKey === vUnitKey) {
			// if (this.onOpenDiscardChangesPopup()) {
			for (var j = 0; j < iEntries; j++) {
				if (oCBDataModel.getData()[iSplicePos].UnitKey === vUnitKey) {
					// vDataUnitKey = oCBDataModel.getData()[iSplicePos].UnitKey;
					oCBDataModel.getData().splice(iSplicePos, 1);
				} else {
					iSplicePos++;
				}
			}
			this.refreshTablesInUnit(vUnitKey);

		},

		onRefreshUnit: function (vUnitKey) {
			var bUnsavedChanges = false;
			if (this.getView().getModel("CBData")) {
				var oCBDataModel = this.getView().getModel("CBData");
				var vDataUnitKey;
				for (var i = 0; i < oCBDataModel.getData().length; i++) {
					vDataUnitKey = oCBDataModel.getData()[i].UnitKey;
					if (vDataUnitKey === vUnitKey) {
						bUnsavedChanges = true;
						this.onOpenDiscardChangesPopup(vUnitKey);
					}
				}
			}
			if (bUnsavedChanges === false) {
				if (sap.ui.getCore().byId('pnl' + vUnitKey).getExpanded()) {
					this.refreshTablesInUnit(vUnitKey);
				}
			}
		},

		refreshTablesInUnit: function (vUnitKey) {
			var oTable = sap.ui.getCore().byId("tbl_plan_" + vUnitKey);
			var oSumTable = sap.ui.getCore().byId("tbl_sum_" + vUnitKey);
			if (oTable.getVisible()) {
				oTable.setBusy(true);
				oTable.destroyColumns();
				this.fillUnitTable(oTable, vUnitKey);
			}
			if (oSumTable.getVisible()) {
				oSumTable.setBusy(true);
				oSumTable.destroyColumns();
				this.fillSumTable(oSumTable, vUnitKey);
			}
		},

		destroyButtonsInUnit: function (vUnitKey) {
			var oTable = sap.ui.getCore().byId("tbl_plan_" + vUnitKey);
			if (oTable) {
				var aColumns = oTable.getColumns();
				var oColumn = {};
				var vAmountOfUnitColumns = 0;
				var vIndexInDateColumns = 0;
				for (var i = 0; i < aColumns.length; i++) {
					oColumn = aColumns[i];
					if (oColumn.getId().match("^c")) {
						vAmountOfUnitColumns++;
					} else {
						vIndexInDateColumns = i - vAmountOfUnitColumns;
						sap.ui.getCore().byId("btn_date" + vUnitKey + vIndexInDateColumns).destroy();
					}
				}
			}
		},

		prepareAUTO: function (vUnitKey) {
			var oModel = this.getView().getModel();
			var oBegda = this.getSelectedBegda();
			var oEndda = this.getSelectedEndda();
			oModel.callFunction("/AutoPlanUnit", {
				method: "POST",
				urlParameters: {
					"UnitKey": vUnitKey,
					"Begda": oBegda,
					"Endda": oEndda
				},
				success: function () {
					this.onRefreshUnit(vUnitKey);
				}.bind(this),
				error: function (oError) {
					this.createError(oError);
				}
			});
		},

		panelExpand: function (oTableSum, oTableData, oToolbar, vUnitKey, oEvent) {
			if (oEvent.getParameter("expand")) {
				//KOBETC 04.02.2021 Busy status coming up from the further called functions
				// oTableData.setBusy(true);
				// oTableSum.setBusy(true);
				if (oEvent.getParameter("triggeredByInteraction") === true) {
					var bSkip = false;
					var vPlanBegda = this.getSelectedBegda().getTime();
					var bRefresh = false;
					for (var i = 0; i < oTableData.getColumns().length; i++) {
						var vDate = Helper.getCustomDataValue(oTableData.getColumns()[i].getCustomData(), "PlanDate");
						vDate = typeof (vDate) === "string" ? parseInt(vDate) : vDate;
						if (vDate) {
							if (vDate !== vPlanBegda) {
								bRefresh = true;
							}
							break;
						}
					}

					if (oTableData.getRows().length === 0) {
						this.fillUnitTable(oTableData, vUnitKey);
					} else if (bRefresh) {
						this.refreshTablesInUnit(vUnitKey);
						bSkip = true;
					}

					if (bSkip === false) {
						if (oTableSum.getRows().length === 0) {
							this.fillSumTable(oTableSum, vUnitKey);
						}

						/*if (oTableSum.getVisible()) {
							setTimeout(function () {
								Helper.autoResize(oTableSum);
							}, 500);
						}

						if (oTableData.getVisible()) {
							setTimeout(function () {
								Helper.autoResize(oTableData);
							}, 500);
						}*/
					}
				}

				for (var i = 0; i < oToolbar.getContent().length; i++) {
					if (oToolbar.getContent()[i].getMetadata().getName() == "sap.m.ToggleButton" || oToolbar.getContent()[i].getMetadata().getName() ==
						"sap.m.Button") {
						oToolbar.getContent()[i].setVisible(true);
					}

					if (oToolbar.getContent()[i].getMetadata().getName() == "sap.m.Select" && this.isFeatureEnabled("VARIANT")) {
						oToolbar.getContent()[i].setVisible(true);
						var aItems = [];
						aItems = oToolbar.getContent()[i].getItems();
						var oObject = {};

						for (var j = 0; j < aItems.length; j++) {
							oObject = {};
							oObject = aItems[j].getBindingContext().getObject();

							if (oObject.IsActive) {
								oToolbar.getContent()[i].setSelectedKey(oObject.Variant);
							}
						}
					}
				}
			} else {
				for (var i = 0; i < oToolbar.getContent().length; i++) {
					if (oToolbar.getContent()[i].getMetadata().getName() == "sap.m.ToggleButton" || oToolbar.getContent()[i].getMetadata().getName() ==
						"sap.m.Button") {
						oToolbar.getContent()[i].setVisible(false);
					}
					if (oToolbar.getContent()[i].getMetadata().getName() == "sap.m.Select") {
						oToolbar.getContent()[i].setVisible(false);
					}
				}
			}
		},

		hideButtons: function (aButtons, oEvent) {
			if (oEvent.getParameter("pressed")) {
				for (var i = 0; i < aButtons.length; i++) {
					if (aButtons[i].getMetadata().getName() == "sap.m.Button" || aButtons[i].getMetadata().getName() == "sap.m.MenuButton") {
						aButtons[i].setVisible(true);
					}
				}
			} else {
				for (var i = 0; i < aButtons.length; i++) {
					if (aButtons[i].getMetadata().getName() == "sap.m.Button" || aButtons[i].getMetadata().getName() == "sap.m.MenuButton") {
						aButtons[i].setVisible(false);
					}
				}
			}
		},

		onHideEmpBtnPress: function (aButtons, vUnitKey, oEvent) {
			var oTable;
			var oVBox;
			var aItems;
			if (oEvent.getParameter("pressed")) {
				for (var i = 0; i < aButtons.length; i++) {
					if (aButtons[i].getId().match("^vbox_hideEmp_")) {
						if (!aButtons[i].getVisible()) {
							aButtons[i].setVisible(true);
						}
						oVBox = sap.ui.getCore().byId(aButtons[i].getId());
						aItems = oVBox.getItems();
						oTable = aItems[0];
						this.buildHideEmpTable(vUnitKey, oTable);
					}
				}
			} else {
				for (var j = 0; j < aButtons.length; j++) {
					if (aButtons[j].getId().match("^vbox_hideEmp_")) {
						oVBox = sap.ui.getCore().byId(aButtons[j].getId());
						aItems = oVBox.getItems();
						oTable = aItems[0];
						oTable.destroyColumns();
						oTable.getExtension()[0].destroy();
						oTable.setVisible(false);
					}
				}
			}
		},

		buildHideEmpTable: function (vUnitKey, oTable) {
			var oPlanBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, this.getSelectedBegda());
			var oPlanEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, this.getSelectedEndda());
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oModel = this.getView().getModel();

			oTable.addColumn(
				new sap.ui.table.Column({
					label: new sap.m.Label({
						text: "{i18n>empname}"
					}),
					template: new sap.m.Text({
						text: "{EmpName}"
					}),
					autoResizable: false
				}));

			oTable.addColumn(new sap.ui.table.Column({
				label: new sap.m.Label({
					text: "{i18n>isshown}",
					tooltip: "{i18n>tthideemp}"
				}),
				template: new sap.m.Switch({
					state: "{Show}",
					type: "AcceptReject",
					change: this.onSwitchEmpVisibility.bind(this)
				}),
				hAlign: "Center",
				autoResizable: false
			}));

			var sBtnId = "tbtn_hideAll" + vUnitKey;
			var oHideAllButton = new sap.m.Switch({
				id: sBtnId,
				tooltip: "{i18n>tthideall}",
				type: "AcceptReject",
				change: this.onHideAllEmps.bind(this, oTable, vUnitKey)
			});

			oTable.addExtension(new sap.m.Toolbar({
				width: "350px",
				content: [
					new sap.m.Label({
						text: "{i18n>lblhideall}"
					}),
					new sap.m.ToolbarSpacer({
						width: "80px"
					}),
					oHideAllButton
				],
				design: "Solid"
			}));

			oTable.setModel(oModel);

			oTable.bindAggregation("rows", {
				path: "/hideEmployeeSet",
				filters: [oPlanBegdaFilter, oPlanEnddaFilter, oUnitFilter],
				events: {
					dataReceived: function (oEvent) {
						oTable.setVisibleRowCount(oEvent.getSource().getContexts().length);
						oTable.setVisible(true);
						this.setInitialHideAllButtonState(oEvent, vUnitKey);
					}.bind(this)
				}
			});

		},

		setInitialHideAllButtonState: function (oEvent, vUnitKey) {
			var aCtx = oEvent.getSource().getContexts();
			var oButton = sap.ui.getCore().byId("tbtn_hideAll" + vUnitKey);
			var iCount = 0;
			$.each(aCtx, function (id, data) {
				if (data.getProperty("Show")) {
					iCount++;
				}
			});
			if (iCount === aCtx.length) {
				oButton.setState(true);
			}
		},

		onHideAllEmps: function (oTable, vUnitKey, oEvent) {
			oTable.setBusy(true);
			var oModel = oTable.getModel();
			var bShow = oEvent.getSource().getState();
			var aCtx;
			var oCtx;
			for (var i = 0; i < oTable.getBinding().getLength(); i++) {
				aCtx = oTable.getBinding().getContexts();
				oCtx = aCtx[i];
				oModel.setProperty("Show", bShow, oCtx);
			}
			oTable.setBusy(false);
			oModel.submitChanges();
			if (!bShow) {
				this.destroyAllRows(vUnitKey);
			}
		},

		destroyAllRows: function (vUnitKey) {
			var oTable = sap.ui.getCore().byId("tbl_plan_" + vUnitKey);
			var oModel = oTable.getModel();
			var aRows = oModel.getData().modelData.rows;
			aRows.splice(0, aRows.length);
			oModel.refresh();
			oTable.setVisibleRowCount(0);
			oTable.refreshRows();
		},

		onSwitchEmpVisibility: function (oEvent) {
			var oCtx = oEvent.getSource().getParent().getBindingContext();
			var oTable = oEvent.getSource().getParent().getParent();
			var oModel = oCtx.getModel();
			var sPath = oCtx.getPath();
			var bShow = oEvent.getParameter("state");
			oModel.setProperty("Show", bShow, oCtx);
			oModel.update(sPath, oCtx.getObject(), {
				refreshAfterChange: false
			});
			if (bShow === false) {
				this.destroySingleRow(oCtx);
				this.setHideAllButtonState(oTable, oCtx.getProperty("UnitKey"));
			} else {
				this.setHideAllButtonState(oTable, oCtx.getProperty("UnitKey"));
				MessageToast.show(this.getResourceBundleText("plsrefresh"));
			}
		},

		setHideAllButtonState: function (oTable, vUnitKey) {
			var sBtnId = "tbtn_hideAll" + vUnitKey;
			var oButton = sap.ui.getCore().byId(sBtnId);
			var oModel = oTable.getModel();
			var iLines = oTable.getBinding().getContexts().length;
			var iCount = 0;
			var aRows = oTable.getRows();
			$.each(aRows, function (id, data) {
				if (data.getBindingContext().getProperty("Show") === true) {
					iCount++;
				}
			}.bind(this));
			if (iCount === iLines) {
				oButton.setState(true);
			} else {
				oButton.setState(false);
			}
		},

		destroySingleRow: function (oCtx) {
			var vUnitKey = oCtx.getProperty("UnitKey");
			var oPlanTable = sap.ui.getCore().byId("tbl_plan_" + vUnitKey);
			var vEmpId = oCtx.getProperty("EmpId");
			if (oPlanTable) {
				var aRows = oPlanTable.getRows();
				if (aRows.length > 0) {
					var iDelCounter = 0;
					var oTable;
					var vLineEmpId;
					var oModel;
					var iId = 0;
					$.each(aRows, function (id, data) {
						oModel = data.getModel();
						vLineEmpId = oModel.getData().modelData.rows[iId].EmpID;
						oTable = data.getParent();
						if (vLineEmpId === vEmpId) {
							oModel.oData.modelData.rows.splice(iId, 1);
							oTable.getAggregation("rows").splice(iId, 1);
							//counter wird hochgezählt, um später die den row count der Tabelle richtig zu berechnen
							iDelCounter++;
						} else {
							//wir müssen iId nur hochzählen, wenn keine Zeile gelöscht wurde. Wird id als Pointer verwendet
							//zeigen wir nach dem Löschen eines Eintrags nicht mehr auf den richtigen im nächsten Durchgang
							iId++;
						}
					}.bind(this));
					oModel.refresh();
					oTable.setVisibleRowCount(oTable.getVisibleRowCount() - iDelCounter);
					oTable.refreshRows();
				}
			}
		},

		hidePlanData: function (aButtons, vUnitKey, oEvent) {
			if (oEvent.getParameter("pressed")) {
				for (var i = 0; i < aButtons.length; i++) {
					if (aButtons[i].getId().match("^tbl_plan_")) {
						var oTable = sap.ui.getCore().byId(aButtons[i].getId());
						oTable.setVisible(true);
						oTable.setBusy(true);
						if (!oTable.getColumns().length) {
							this.fillUnitTable(oTable, vUnitKey);
						} else {
							this.unitTableFinalService(oTable);
						}

						/*setTimeout(function () {
							Helper.autoResize(oTable);
						}, 500);*/
					}

				}
			} else {
				for (var i = 0; i < aButtons.length; i++) {
					if (aButtons[i].getId().match("^tbl_plan_")) {
						var oTable = sap.ui.getCore().byId(aButtons[i].getId());
						// oTable.setBusy(true);
						oTable.destroyColumns();
						oTable.setVisible(false);
					}
				}
			}
		},
		hideSumData: function (aButtons, vUnitKey, oEvent) {
			if (oEvent.getParameter("pressed")) {
				for (var i = 0; i < aButtons.length; i++) {
					if (aButtons[i].getId().match("^tbl_sum_")) {
						var oTable = sap.ui.getCore().byId(aButtons[i].getId());
						oTable.setVisible(true);
						oTable.setBusy(true);
						this.fillSumTable(oTable, vUnitKey);
						/*setTimeout(function () {
							Helper.autoResize(oTable);
						}, 500);*/
					}
				}
			} else {
				for (var i = 0; i < aButtons.length; i++) {
					if (aButtons[i].getId().match("^tbl_sum_")) {
						var oTable = sap.ui.getCore().byId(aButtons[i].getId());
						oTable.destroyColumns();
						oTable.setVisible(false);
					}
				}

			}
		},

		setUnbusy: function (oControl) {
			oControl.setBusy(false);
		},
		
		prepareABSENCES: function (vUnitKey) {
			TimesOverview.setController(this);
			TimesOverview.openTimeOverviewPopup(null, vUnitKey, null, "TO_ABS");
		},

		prepareLEGEND: function (vUnitKey) {
			if (!this._oLegendDialog) {
				this._oLegendDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.ColorLegend", this);
			}
			this.getView().addDependent(this._oLegendDialog);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.NE, vUnitKey);
			var oModel = this.getView().getModel();

			oModel.read("/legendSet", {
				filters: [oUnitFilter],
				success: this.legendReadSuccess.bind(this, vUnitKey)
			});
			this._oLegendDialog.attachAfterClose(this.destroyLegendDialog.bind(this));
			this._oLegendDialog.open();
			this._oLegendDialog.setBusyIndicatorDelay(0);
			this._oLegendDialog.setBusy(true);
		},
		closeLegendDialog: function () {
			this._oLegendDialog.close();
		},

		destroyLegendDialog: function () {
			this._oLegendDialog.destroy();
			this._oLegendDialog = null;
		},

		legendReadSuccess: function (vUnitKey, oData) {
			var aData = oData.results;
			var oFormContainer = sap.ui.getCore().byId("FormLegend");
			oFormContainer.destroyContent();

			for (var i = 0; i < aData.length; i++) {
				var oLabelColor = new sap.m.Label({
					width: "50px",
					layoutData: new sap.ui.layout.GridData({
						span: "XL1 L1 M1 S1",
						linebreak: true
					})
				});
				oLabelColor.addCustomData(new sap.ui.core.CustomData({
					key: "background",
					// writeToDom: true,
					value: aData[i].LegendColor
				}));
				oLabelColor.addEventDelegate({
					onAfterRendering: this.onAfterRenderLegendText
				});
				var oLabel = new sap.m.Text({
					text: aData[i].LegendText,
					layoutData: new sap.ui.layout.GridData({
						span: "XL11 L11 M11 S11"
					})
				});
				oFormContainer.addContent(oLabelColor);
				oFormContainer.addContent(oLabel);
			}
			this._oLegendDialog.setBusy(false);
		},

		prepareLOG: function (vUnitKey) {
			if (!this._oLogDialog) {
				this._oLogDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.Log", this);
			}
			this.getView().addDependent(this._oLogDialog);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.NE, vUnitKey);
			this._oLogDialog.attachAfterClose(this.destroyLogPopup.bind(this));
			this._oLogDialog.setBusyIndicatorDelay(0);
			this._oLogDialog.setBusy(true);

			var oModel = this.getView().getModel();
			var oTable = sap.ui.getCore().byId("tbl_log");

			oTable.setModel(oModel);

			oTable.bindAggregation("rows", {
				path: "/logSet",
				filters: [oUnitFilter],
				events: {
					dataReceived: function (oEvent) {
						this._oLogDialog.setBusy(false);
					}.bind(this)
				}
			});

			this._oLogDialog.open();

		},

		closeLogDialog: function () {
			this._oLogDialog.close();
		},

		destroyLogPopup: function () {
			this._oLogDialog.destroy();
			this._oLogDialog = null;
		},

		onAfterRenderLegendText: function (oEvent) {
			var cellId = oEvent.srcControl.getId();
			if (oEvent.srcControl.getAggregation("customData")[0].getProperty("key") == "background") {
				var vValue = oEvent.srcControl.getAggregation("customData")[0].getProperty("value");

			} else {
				var vValue = oEvent.srcControl.getAggregation("customData")[1].getProperty("value");
			}
			if (vValue != "") {
				$("#" + cellId).parent().css("background-color", vValue);
			}
		},

		prepareADDEMP: function (vUnitKey, oEvent) {
			this.getView().getModel().read("/employeeFilterCustSet('" + vUnitKey + "')", {
				success: this.openAddEmployee.bind(this, vUnitKey)
			});
		},
		onEditVerleihung: function (oEvent) {
			if (!this._addNeueWerkerverleihung) {
				this._addNeueWerkerverleihung = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.Werkerverleihung", this, {
					refreshAfterChange: true
				});
				this.getView().addDependent(this._addNeueWerkerverleihung);
			}
			this._addNeueWerkerverleihung.open();
		},
		onEditVerleihungSender: function (oEvent) {

			var oButton = oEvent.getSource();
			var oBindingContext = oButton.getBindingContext();
			var oBindingObject = oBindingContext.getObject(); //

		},
		prepareWERKERVER: function (vUnitKey, oEvent) {
			if (!this._addWerkerverleihung) {
				this._addWerkerverleihung = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.VerleihungAnlegen", this, {
					refreshAfterChange: true
				});
				this.getView().addDependent(this._addWerkerverleihung);
			}
			this._addWerkerverleihung.open();

			var oSenderVerleihungReceiver = sap.ui.getCore().byId("idVerleihungTableReciver");
			var oModel = this.getView().getModel();

			oSenderVerleihungReceiver.setBusyIndicatorDelay(0);
			oSenderVerleihungReceiver.setBusy(true);
			oSenderVerleihungReceiver.setModel(oModel);
			oSenderVerleihungReceiver.unbindAggregation("rows");
			oSenderVerleihungReceiver.unbindAggregation("items");
			oSenderVerleihungReceiver.bindAggregation("rows", {
				path: "/verleihungReceiverSet",
				//			filters: [oFilterDate, oFilterUnit],
				//			groupId: vUnitKey,
				events: {
					dataReceived: function () {
						oSenderVerleihungReceiver.setBusy(false);
						this.getView().getModel("Customizing").setProperty("/ReceiverRow", oSenderVerleihungReceiver._iBindingLength);
						this.getView().getModel("Customizing").refresh();
					}.bind(this)
				}
			});

			var oSenderVerleihungSender = sap.ui.getCore().byId("idVerleihungTableSender");
			oSenderVerleihungSender.setBusyIndicatorDelay(0);
			oSenderVerleihungSender.setBusy(true);
			oSenderVerleihungSender.setModel(oModel);
			oSenderVerleihungSender.unbindAggregation("rows");
			oSenderVerleihungSender.unbindAggregation("items");
			oSenderVerleihungSender.bindAggregation("rows", {
				path: "/verleihungSenderSet",
				events: {
					dataReceived: function () {
						oSenderVerleihungSender.setBusy(false);
						this.getView().getModel("Customizing").setProperty("/SenderRow", oSenderVerleihungSender._iBindingLength);
						this.getView().getModel("Customizing").refresh();
					}.bind(this)
				}
			});

			var oFilterUnit = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

			this.getView().getModel().read("/loan_employeSet", {
				filters: [oFilterUnit],
				success: function (oData) {
					this.getView().getModel("Customizing").setProperty("/loan_employe", oData.results);
					this.getView().getModel("Customizing").refresh();
				}.bind(this),
				error: function (oError) {
					//implement suitable error handling here
				}
			});

		},

		_loadEmployeeTime: function (vUnitKey, oTime) {
			this.getView().getModel("Customizing").setProperty("/vUnitKey", vUnitKey);
			var oNewTimeTable = sap.ui.getCore().byId("idEmployeeNewTimeTable");
			var oModel = this.getView().getModel();

			var oEndda = new Date();
			oEndda.setDate(oTime.getDate() + 1);
			oNewTimeTable.setBusyIndicatorDelay(0);
			oNewTimeTable.setBusy(true);
			var oFilterDate = new sap.ui.model.Filter("PlanDate", sap.ui.model.FilterOperator.BT, oTime, oEndda);
			var oFilterUnit = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			sap.ui.getCore().byId("DateStartTime").setDateValue(oTime);

			oNewTimeTable.setBusyIndicatorDelay(0);
			oNewTimeTable.setBusy(true);
			oNewTimeTable.setModel(oModel);
			oNewTimeTable.unbindAggregation("rows");
			oNewTimeTable.unbindAggregation("items");
			oNewTimeTable.bindAggregation("rows", {
				path: "/GetEmployeeListforEndTimeSet",
				filters: [oFilterDate, oFilterUnit],
				groupId: vUnitKey,
				events: {
					dataReceived: function () {
						oNewTimeTable.setBusy(false);
					}
				}
			});

		},
		prepareTIMEEND: function (vUnitKey, oEvent) {

			if (!this._addBusinessTime) {
				this._addBusinessTime = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.addNewBusinessTime", this, {
					refreshAfterChange: true
				});
				this.getView().addDependent(this._addBusinessTime);
			}
			this._addBusinessTime.open();
			var oDate = new Date();
			oDate.setDate(oDate.getDate() + 1);
			this._loadEmployeeTime(vUnitKey, oDate);

		},
		changeDateStart: function () {
			var vUnitKey = this.getView().getModel("Customizing").getProperty("/vUnitKey");
			var oDate = sap.ui.getCore().byId("DateStartTime").getDateValue();
			oDate.setHours(oDate.getHours() + 8);
			this._loadEmployeeTime(vUnitKey, oDate);
			sap.ui.getCore().byId("TP2").setDateValue();
		},
		closeNewTime: function () {
			this._addBusinessTime.close();
		},
		closeWerkerverleihung: function () {
			this._addNeueWerkerverleihung.close();
		},
		saveWerkerverleihung: function () {
			this._addNeueWerkerverleihung.close();
		},

		closeVerleihungen: function () {
			this._addWerkerverleihung.close();
		},

		saveNewTime: function () {
			var oTable = sap.ui.getCore().byId("idEmployeeNewTimeTable");
			var oBegda = this.getSelectedBegda();
			var oExportTable = [];

			for (var i = 0; i < oTable.getRows().length; i++) {
				if (oTable.getRows()[i].getCells()[0].getText() !== "") {
					var oData = oTable.getRows()[i].getBindingContext().sPath.split('Employee=');
					var oEmployee = oData[1].substring(1, 11);
					var oValue = oTable.getRows()[i].getCells()[2].getValue();
					var oSplit = oValue.split(":");
					var oDate = 'PT' + oSplit[0] + 'H' + oSplit[1] + 'M00S';

					var oEntry = {
						EmpId: oEmployee,
						PlanDate: oBegda,
						Time: oDate
					};
					oExportTable.push(oEntry);
				}
			}

			var oSendToBackend = {
				SaveNewTimeforBusinessTripNav: oExportTable
			};

			this.getView().getModel().create("/SaveNewTimeforBusinessTripSet", oSendToBackend, {
				refreshAfterChange: true,
				success: function () {
					MessageToast.show(this.getResourceBundleText("saved"));
					this._addBusinessTime.close();
				}.bind(this),
				error: function () {
					MessageBox.error(this.getResourceBundleText("tterror"));
				}.bind(this)
			});
		},

		ModifyAllTime: function () {
			var oGeneralTime = sap.ui.getCore().byId("TP2");
			var oTable = sap.ui.getCore().byId("idEmployeeNewTimeTable");
			for (var i = 0; i < oTable.getRows().length; i++) {
				oTable.getRows()[i].getCells()[2].setValue(oGeneralTime.getValue());
			}

		},
		openAddEndTime: function (vUnitKey, oData) {

		},

		openAddEmployee: function (vUnitKey, oData) {
			this.getView().setBusy(true);
			var oModel = this.getView().getModel();
			var oTable;
			var vVisible;
			if (this.isFeatureEnabled("DROPDOWN")) {
				vVisible = true;
			} else {
				vVisible = false;
			}

			//12.11.2020 Anna Grigoran Begda and Endda of oCalnder should be 1 day before/after the selected range
			var oBegda = this.getSelectedBegda();
			var oEndda = this.getSelectedEndda();
			if (oBegda === undefined || oEndda === undefined) {
				this.getView().setBusy(false);
				return;
			}
			oBegda.setDate(oBegda.getDate() - 1);
			oEndda.setDate(oEndda.getDate() + 1);

			if (!this._oAddEmployeeDialog) {
				//29.10.2020 Anna Grigoran: add Controller to Fragment
				var oFragmentController = new FragmentSelectEmployee(this, vUnitKey);
				this._oAddEmployeeDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.SelectEmployee", oFragmentController);
				oFragmentController.createEmpTable();
				this._oAddEmployeeDialog.attachAfterClose(this.destroySelectDialog.bind(this));
				this._oAddEmployeeDialog.attachAfterOpen(this.setDialogUnbusy.bind(this));
				oTable = sap.ui.getCore().byId("tbl_emp_selection");
			}

			var oEmpSearchButton = sap.ui.getCore().byId("sf_emp_name");
			oEmpSearchButton.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));

			this._oAddEmployeeDialog.setBusyIndicatorDelay(0);
			this._oAddEmployeeDialog.setBusy(true);
			this.oEmployeeFilterCust = oData;
			this.getView().addDependent(this._oAddEmployeeDialog);

			var oCalendar = sap.ui.getCore().byId("cal_date_int");
			oCalendar.removeCustomData("UnitKey");
			oCalendar.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));
			oCalendar.setStartDate(oBegda);
			var oDateRange = new sap.ui.unified.DateRange();
			var oSelect = sap.ui.getCore().byId("select_add_quals");
			var oSelectLabel = sap.ui.getCore().byId("lbl_add_quals");
			oSelect.setVisible(vVisible);
			oSelectLabel.setVisible(vVisible);
			if (oSelect.getEnabled()) {
				if (this.oCustomizing.PlanHideQKey) {
					var oTemplate = new sap.ui.core.Item({
						text: "{QualText}",
						key: "{QualId}"
					});
				} else {
					var oTemplate = new sap.ui.core.Item({
						text: "{QualId} - {QualText}",
						key: "{QualId}"
					});
				}
				oSelect.destroyItems();
				var oUnitFilterEQ = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

				oSelect.setModel(oModel);
				oSelect.bindAggregation("items", {
					path: "/qualificationSet",
					filters: [oUnitFilterEQ],
					template: oTemplate
				});

			}

			// oDateRange.setStartDate(this.getSelectedBegda());
			// oDateRange.setEndDate(this.getSelectedEndda());

			oDateRange.setStartDate(oBegda);
			oDateRange.setEndDate(oEndda);
			oCalendar.insertSelectedDate(oDateRange);

			//30.10.2020 Anna Grigoran
			//sap.ui.getCore().byId("btn_emp_add").attachPress(this.addEmployee.bind(this, vUnitKey));

			if (oData.EmpQualAvailable) {
				this.loadQualsInAddEmployee(vUnitKey);
			}
			if (oData.EmpSgAvailable) {
				// var oSgBox = sap.ui.getCore().byId("vb_sg");
				var oSgBox = sap.ui.getCore().byId("mcb_sg");
				sap.ui.getCore().byId("vb_sg_box").setVisible(true);
				// var oCheckboxSg = new sap.m.CheckBox({
				// 	text: "{SgText}",
				// 	selected: false
				// });
				// oCheckboxSg.addCustomData(new sap.ui.core.CustomData({
				// 	key: "sgid",
				// 	value: "{SgKey}"
				// }));

				var oCheckboxSg = new sap.ui.core.Item({
					text: "{SgText}",
					key: "{SgKey}"
				});

				oSgBox.setModel(oModel);
				oSgBox.bindAggregation("items", {
					path: "/shiftGroupFilterSet",
					filters: [oUnitFilterEQ],
					template: oCheckboxSg,
					events: {
						dataReceived: function () {
							if (sap.ui.getCore().byId("mcb_sg").getAggregation("items").length > 0) {
								sap.ui.getCore().byId("mcb_sg").setVisible(true);
							}
						}.bind(this)
					}
				});

				//05.11.2020 Anna Grigoran: add range date
				var oRangeBegda = sap.ui.getCore().byId("dp_begda");
				var oRangeEndda = sap.ui.getCore().byId("dp_endda");

				oRangeBegda.setDateValue(this.getSelectedBegda());

				if (this.isFeatureEnabled("EMPONEDAY")) {
					oRangeEndda.setDateValue(this.getSelectedBegda());
				} else {
					oRangeEndda.setDateValue(this.getSelectedEndda());
				}

				// oRangeBegda.setValue(this.getSelectedBegda().toLocaleDateString());
				// oRangeEndda.setValue(this.getSelectedEndda().toLocaleDateString());
				// oRangeBegda.setMaxDate(this.getSelectedEndda());
				// oRangeEndda.setMinDate(this.getSelectedBegda());

			}

			if (oData.EmpAvailAvailable) {
				var oAvBox = sap.ui.getCore().byId("vb_av");
				sap.ui.getCore().byId("vb_av_box").setVisible(true);
				var oTemplate = new sap.m.CheckBox({
					text: "{AvailText}",
					selected: false
				});
				oTemplate.addCustomData(new sap.ui.core.CustomData({
					key: "AvailKey",
					// writeToDom: true,
					value: {
						path: "AvailKey"
					}
				}));
				oAvBox.setModel(oModel);
				oAvBox.bindAggregation("items", {
					path: "/availabilityFilterSet",
					filters: [oUnitFilterEQ],
					template: oTemplate
				});
			}

			if (oData.EmpNameSearchAvail) {
				sap.ui.getCore().byId("vb_ns_box").setVisible(true);
			}

			this._oAddEmployeeDialog.open();
			this.getView().setBusy(false);
		},

		setDialogUnbusy: function (oEvent) {
			oEvent.getSource().setBusy(false);
		},

		fillAssignableEmployeesTable: function (oData) {
			var aData = oData.results;
			var oTable = sap.ui.getCore().byId("tbl_emp_selection");
			oTable.setBusy(true);
			var oModel = new sap.ui.model.json.JSONModel();

			oModel.setData({
				modelData: aData
			});
			// oTable.setVisibleRowCount(aData.length);
			oTable.setModel(oModel).bindRows("/modelData");
			if (this._oAddEmployeeDialog.getBusy() === true) {
				this._oAddEmployeeDialog.setBusy(false);
			}
			if (oTable.getBusy() === true) {
				oTable.setBusy(false);
			}

		},

		loadQualsInAddEmployee: function (vUnitKey) {
			var oBegda = this.getSelectedBegda();
			var oEndda = this.getSelectedEndda();
			var oModel = this.getView().getModel();
			if (oEndda == null || oEndda == undefined) {
				return;
			}
			var oPlanBegda = this.getSelectedBegda(
				"cal_date_int");
			var oPlanEndda = this.getSelectedEndda(
				"cal_date_int");

			if (oPlanEndda == null || oPlanEndda == undefined) {
				return;
			}
			oBegda.setHours(12);
			oEndda.setHours(12);
			var oBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, oPlanBegda);
			var oEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, oPlanEndda);
			sap.ui.getCore().byId("vb_qual_box").setVisible(true);
			var oMCB = sap.ui.getCore().byId("mcb_quals");
			var oDemandFilterFalse = new sap.ui.model.Filter("HasBedarf", sap.ui.model.FilterOperator.EQ, false);
			var oDemandFilterTrue = new sap.ui.model.Filter("HasBedarf", sap.ui.model.FilterOperator.EQ, true);

			var oQualBox = sap.ui.getCore().byId("vb_qual");
			var oUnitFilterEQ = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

			if (this.oCustomizing.PlanHideQKey) {
				var oCheckboxQual = new sap.m.CheckBox({
					text: "{QualText}",
					selected: false
				});
			} else {
				var oCheckboxQual = new sap.m.CheckBox({
					text: "{QualKey} - {QualText}",
					selected: false
				});
			}

			oCheckboxQual.addCustomData(new sap.ui.core.CustomData({
				key: "qualid",
				value: "{QualKey}"
			}));

			if (!this.isFeatureEnabled("DEMAND")) {
				oQualBox.setModel(oModel);
				oQualBox.bindAggregation("items", {
					path: "/qualificationFilterSet",
					filters: [oUnitFilterEQ],
					template: oCheckboxQual
				});
			} else {
				oQualBox.setModel(oModel);
				oQualBox.bindAggregation("items", {
					path: "/qualificationFilterSet",
					filters: [oUnitFilterEQ, oBegdaFilter, oEnddaFilter, oDemandFilterTrue],
					template: oCheckboxQual
				});

				if (this.oCustomizing.PlanHideQKey) {
					var oTemplateMCB = new sap.ui.core.Item({
						text: "{QualText}",
						key: "{QualKey}"
					});
				} else {
					var oTemplateMCB = new sap.ui.core.Item({
						text: "{QualKey} - {QualText}",
						key: "{QualKey}"
					});
				}
				oMCB.setModel(oModel);
				oMCB.bindAggregation("items", {
					path: "/qualificationFilterSet",
					filters: [oUnitFilterEQ, oBegdaFilter, oEnddaFilter, oDemandFilterFalse],
					template: oTemplateMCB,
					events: {
						dataReceived: function () {
							if (sap.ui.getCore().byId("mcb_quals").getAggregation("items").length > 0) {
								sap.ui.getCore().byId("mcb_quals").setVisible(true);
							}
						}.bind(this)
					}
				});

			}
		},

		//05.11.2020 Anna Grigoran: In FragementSelectEmployee.js
		// handleCalendarSelect: function (oEvent) {
		// 	var oTable = sap.ui.getCore().byId("tbl_emp_selection");
		// 	var aCustomData = oEvent.getSource().getCustomData();
		// 	var vUnitKey = Helper.getCustomDataValue(aCustomData, "UnitKey");
		// 	this.selectAddEmployees(oTable, vUnitKey, oEvent);
		// 	this.loadQualsInAddEmployee(vUnitKey);
		// },

		//05.11.2020 Anna Grigoran: In FragementSelectEmployee.js
		// onSearchEmpName: function (oEvent) {
		// 	var oTable = sap.ui.getCore().byId("tbl_emp_selection");
		// 	var aCustomData = oEvent.getSource().getCustomData();
		// 	var vUnitKey = Helper.getCustomDataValue(aCustomData, "UnitKey");
		// 	this.selectAddEmployees(oTable, vUnitKey, oEvent);
		// },

		//05.11.2020 Anna Grigoran: In FragementSelectEmployee.js
		// selectAddEmployees: function (oTable, vUnitKey, oEvent) {
		// 	var oModel = this.getView().getModel();
		// 	var oBox;
		// 	var i;
		// 	var aFilters = [];
		// 	var aItems;
		// 	var oFilter;
		// 	var aCustomData;
		// 	var vEventId = oEvent.getId();
		// 	var oSearchField = sap.ui.getCore().byId("sf_emp_name");
		// 	var vEmpName;
		// 	oTable.setBusy(true);

		// 	switch (vEventId) {
		// 	case "search":
		// 		vEmpName = oSearchField.getValue();
		// 		if (vEmpName != "") {
		// 			oFilter = new sap.ui.model.Filter("EmpName", sap.ui.model.FilterOperator.EQ, vEmpName);
		// 			aFilters.push(oFilter);
		// 		}
		// 		break;
		// 	case "press":
		// 		vEmpName = "";
		// 		break;
		// 	case "select":
		// 		vEmpName = "";
		// 		break;
		// 	default:
		// 		return;
		// 	}

		// 	if (this.oEmployeeFilterCust.EmpQualAvailable) {
		// 		oBox = sap.ui.getCore().byId("vb_qual");
		// 		aItems = oBox.getItems();
		// 		for (i = 0; i < aItems.length; i++) {
		// 			if (aItems[i].getProperty("selected") === true) {
		// 				aCustomData = aItems[i].getAggregation("customData");
		// 				oFilter = new sap.ui.model.Filter("EmpQual", sap.ui.model.FilterOperator.EQ, Helper.getCustomDataValue(aCustomData,
		// 					"qualid"));
		// 				aFilters.push(oFilter);

		// 			}
		// 		}

		// 		var oMCB = sap.ui.getCore().byId("mcb_quals");
		// 		aItems = oMCB.getSelectedKeys();
		// 		for (i = 0; i < aItems.length; i++) {
		// 			oFilter = new sap.ui.model.Filter("EmpQual", sap.ui.model.FilterOperator.EQ, aItems[i]);
		// 			aFilters.push(oFilter);
		// 		}
		// 	}

		// 	if (this.oEmployeeFilterCust.EmpSgAvailable) {
		// 		// oBox = sap.ui.getCore().byId("vb_sg");
		// 		// aItems = oBox.getItems();
		// 		// for (i = 0; i < aItems.length; i++) {
		// 		// 	if (aItems[i].getProperty("selected") === true) {
		// 		// 		aCustomData = aItems[i].getAggregation("customData");
		// 		// 		oFilter = new sap.ui.model.Filter("EmpShiftGroup", sap.ui.model.FilterOperator.EQ, Helper.getCustomDataValue(aCustomData,
		// 		// 			"sgid"));
		// 		// 		aFilters.push(oFilter);
		// 		// 	}
		// 		// }

		// 		var oSG = sap.ui.getCore().byId("mcb_sg");
		// 		aItems = oSG.getSelectedKeys();
		// 		for (i = 0; i < aItems.length; i++) {
		// 			oFilter = new sap.ui.model.Filter("EmpShiftGroup", sap.ui.model.FilterOperator.EQ, aItems[i]);
		// 			aFilters.push(oFilter);
		// 		}

		// 	}

		// 	if (this.oEmployeeFilterCust.EmpAvailAvailable) {
		// 		oBox = sap.ui.getCore().byId("vb_av");
		// 		aItems = oBox.getItems();
		// 		var vKey;
		// 		var aCustomData;
		// 		for (i = 0; i < aItems.length; i++) {
		// 			if (aItems[i].getProperty("selected") === true) {
		// 				aCustomData = aItems[i].getAggregation("customData");
		// 				vKey = Helper.getCustomDataValue(aCustomData, "AvailKey");
		// 				oFilter = new sap.ui.model.Filter("EmpAvail", sap.ui.model.FilterOperator.EQ, vKey);
		// 				aFilters.push(oFilter);
		// 			}
		// 		}
		// 	}

		// 	var oSelectedBegda = this.getSelectedBegda();
		// 	var oSelectedEndda = this.getSelectedEndda();
		// 	if (oSelectedEndda == null || oSelectedEndda == undefined) {
		// 		return;
		// 	}
		// 	var oPlanBegda = this.getSelectedBegda(
		// 		"cal_date_int");
		// 	var oPlanEndda = this.getSelectedEndda(
		// 		"cal_date_int");

		// 	if (oPlanEndda == null || oPlanEndda == undefined) {
		// 		this._oAddEmployeeDialog.setBusy(false);
		// 		return;
		// 	}

		// 	oSelectedBegda.setUTCDate(oSelectedBegda.getDate());
		// 	oSelectedEndda.setUTCDate(oSelectedEndda.getDate());
		// 	oPlanBegda.setUTCDate(oPlanBegda.getDate());
		// 	oPlanEndda.setUTCDate(oPlanEndda.getDate());

		// 	var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.NE, vUnitKey);
		// 	var oPlanBegdaFilter = new sap.ui.model.Filter("PlanBegda", sap.ui.model.FilterOperator.EQ, oSelectedBegda);
		// 	var oPlanEnddaFilter = new sap.ui.model.Filter("PlanEndda", sap.ui.model.FilterOperator.EQ, oSelectedEndda);
		// 	var oSelectBegdaFilter = new sap.ui.model.Filter("SelectBegda", sap.ui.model.FilterOperator.EQ, oPlanBegda);
		// 	var oSelectEnddaFilter = new sap.ui.model.Filter("SelectEndda", sap.ui.model.FilterOperator.EQ, oPlanEndda);
		// 	aFilters.push(oUnitFilter);
		// 	aFilters.push(oPlanBegdaFilter);
		// 	aFilters.push(oPlanEnddaFilter);
		// 	aFilters.push(oSelectBegdaFilter);
		// 	aFilters.push(oSelectEnddaFilter);

		// 	oModel.read("/assignedEmployeesSet", {
		// 		filters: aFilters,
		// 		success: function (oData) {
		// 			this.fillAssignableEmployeesTable(oData);
		// 		}.bind(this)
		// 	});
		// },

		destroySelectDialog: function () {
			this._oAddEmployeeDialog.destroy();
			this._oAddEmployeeDialog = null;
		},

		closeSelectDialog: function () {
			this._oAddEmployeeDialog.close();
		},

		addEmployee: function (vUnitKey) {
			var oModel = this.getView().getModel();
			var oTable = sap.ui.getCore().byId("tbl_emp_selection");
			var vIndex = oTable.getSelectedIndex();
			//05.11.2020 Anna Grigoran: no selected item 
			if (vIndex === -1) {
				return;
			}
			var oRow = oTable.getContextByIndex(vIndex).getObject().EmpId;

			//05.11.2020 Anna Grigoran date from range
			// var oBegda = this.getSelectedBegda("cal_date_int");
			// var oEndda = this.getSelectedEndda("cal_date_int");
			var oRangeBegda = sap.ui.getCore().byId("dp_begda");
			var oRangeEndda = sap.ui.getCore().byId("dp_endda");
			var oBegda = oRangeBegda.getDateValue();
			var oEndda = oRangeEndda.getDateValue();

			var oQualSelect = sap.ui.getCore().byId("select_add_quals");

			var vQualKey = '';

			if (oQualSelect.getVisible()) {
				var vQualKey = oQualSelect.getSelectedKey();
			} else {
				vQualKey = '';
			}

			oBegda.setUTCDate(oBegda.getDate());
			oEndda.setUTCDate(oEndda.getDate());
			if ((oRow != null && oRow != undefined)) {
				oModel.callFunction("/CheckAddEmployee", {
					method: "POST",
					urlParameters: {
						"QualKey": vQualKey,
						"EmpId": oRow,
						"UnitKey": vUnitKey,
						"Begda": oBegda,
						"Endda": oEndda
					},
					success: function (oData, response) {
						this.checkSuccess(oRow, vUnitKey, oBegda, oEndda, vQualKey);
					}.bind(this),
					error: function (oError) {
						var aErrorMsg = JSON.parse(oError.responseText).error.innererror.errordetails;
						var vHasError = false;
						for (var i = 0; i < aErrorMsg.length; i++) {
							if (aErrorMsg[i].code == "/IWBEP/CX_MGW_BUSI_EXCEPTION") {
								aErrorMsg.splice(i, 1);
							}
						}

						for (var j = 0; j < aErrorMsg.length; j++) {
							if (aErrorMsg[j].severity == "error") {
								vHasError = true;
							}
						}
						var oModel = new sap.ui.model.json.JSONModel();
						oModel.setData(aErrorMsg);

						var oMessageView = new sap.m.MessageView({
							items: {
								path: "/",
								template: oMessageItem
							}
						});

						var oDialog = new sap.m.Dialog({
							title: ((vHasError) ? "{i18n>errormsg}" : "{i18n>warningmsg}"),
							resizable: true,
							content: oMessageView,
							endButton: new sap.m.Button({
								press: function () {
									oDialog.close();
								},
								text: "{i18n>close}"
							}),
							contentHeight: "300px",
							contentWidth: "500px",
							verticalScrolling: false
						});

						oMessageView.setModel(oModel);
						oDialog.setState((vHasError) ? "Error" : "Warning");
						this.getView().addDependent(oDialog);
						if (!vHasError) {
							oDialog.setBeginButton(new sap.m.Button({
								text: "{i18n>adduser}",
								press: function () {
									oDialog.close();
									this.checkSuccess(oRow, vUnitKey, oBegda, oEndda, oQualSelect.getSelectedKey());
								}.bind(this)
							}));
						}
						oDialog.open();
					}.bind(this)
				});
			}
		},

		checkSuccess: function (oRow, vUnitKey, oBegda, oEndda, vQual, vEmpName) {
			var oModel = this.getView().getModel();
			var vEmpName2;

			if (vEmpName === undefined || vEmpName === null) {
				vEmpName2 = "";
			} else {
				vEmpName2 = vEmpName.toString();
			}

			oModel.callFunction("/AddEmployee", {
				method: "POST",
				urlParameters: {
					"EmpName": vEmpName2,
					"QualKey": vQual,
					"EmpId": oRow,
					"UnitKey": vUnitKey,
					"Begda": oBegda,
					"Endda": oEndda
				},
				success: function (oData, response) {
					this.refreshAllTables();
					this._oAddEmployeeDialog.close();
					this._oAddEmployeeDialog.destroy();
					this._oAddEmployeeDialog = null;
				}.bind(this),
				error: function (oError) {
					this.createError(oError);
				}.bind(this)
			});
		},

		checkSuccessPool: function (oRow, vUnitKey, oBegda, oEndda, vQual, vEmpName) {
			var oModel = this.getView().getModel();
			var vEmpName2;

			if (vEmpName === undefined || vEmpName === null) {
				vEmpName2 = "";
			} else {
				vEmpName2 = vEmpName.toString();
			}

			oModel.callFunction("/AddEmployee", {
				method: "POST",
				urlParameters: {
					"EmpName": vEmpName2,
					//					"QualKey": vQual,
					"EmpId": oRow,
					"UnitKey": vUnitKey,
					"Begda": oBegda,
					"Endda": oEndda
				},
				success: function (oData, response) {}.bind(this),
				error: function (oError) {
					this.createError(oError);
				}.bind(this)
			});
		},

		fillUnitTable: function (oTable, vUnitKey) {
			oTable.setBusy(true);
			this.fillUnitColumns(oTable, vUnitKey);
		},

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
					success: this.sumMetaSuccess.bind(this, oTable, vUnitKey),
					error: function () {
						oTable.setBusy(false);
					}.bind(this)
				});
			}
		},

		readCustomizing: function () {
			this.getView().getModel().read("/featureUsageSet", {
				success: function (oData) {
					$.when(this.readFunctionsSuccess(oData)).then(function () {
						this.getView().getModel().read("/customizingUISet(1)", {
							success: function (oDataCust) {
								$.when(this.readCustomizingSuccess(oDataCust)).then(function () {
									this.getView().getModel().read("/genCustSet", {
										success: function (oGenCust) {
											$.when(this.readGenCustSuccess(oGenCust)).then(function () {
												// var oSButton = this.getView().byId("sbtn_rowheight");
												var oSlider = this.getView().byId("slider_nolines");
												if (this.isFeatureEnabled("ROWCOUNT")) {
													oSlider.setVisible(true);
													this.getView().byId("lbl_slider_nolines").setVisible(true);
												}
												// if (this.isFeatureEnabled("ROWHEIGHT")) {
												// 	oSButton.setVisible(true);
												// 	this.getView().byId("lbl_rowheight").setVisible(true);
												// }
												if (this.isFeatureEnabled("EMPSEARCH")) {
													this.getView().byId("btn_search_employee").setVisible(true);
												}
												this.getView().getModel().read("/userCustomizingSet('sy-uname')", {
													success: function (oData) {
														var userModel = this.getView().getModel("UserData");
														this.oUserCust = oData;
														//KOBETC: User Customizing Data additionally put to model
														var aKeys = Object.keys(oData);
														aKeys.forEach(function (key) {
															userModel.setProperty("/" + key, oData[key]);
														});
														// this.getView().getModel("UserData").setData(oData);
														oSlider.setValue(this.oUserCust.Nooflines);
														// 		oSButton.setSelectedKey(this.oUserCust.Rowheight);

														this.applyingChangesAfterUserCustomizing();
													}.bind(this),
													error: function () {
														oSlider.setValue(this.oCustomizing.PlanVisRows);
														// 		oSButton.setSelectedKey("COMPACT");
													}.bind(this)
												});
											}.bind(this));
										}.bind(this),
										error: this.handleError.bind(this)
									});

								}.bind(this));
							}.bind(this),
							error: this.handleError.bind(this)
						});
					}.bind(this));
				}.bind(this),
				error: this.handleError.bind(this)
			});
		},

		applyingChangesAfterUserCustomizing: function () {
			this.getView().byId('sbtn_rowheight').fireSelectionChange();
		},

		readFunctionsSuccess: function (oData, oResponse) {
			var oDeferred = $.Deferred(),
				oUserModel = this.getView().getModel("UserData");
			if (oData.results) {
				oDeferred.resolve();
				this.aFeatureUsage = oData.results;

				oUserModel.setProperty('/features', {});
				oData.results.forEach(function (item) {
					oUserModel.setProperty('/features/' + item.FeatureKey, item);
				});
			} else {
				oDeferred.resolve();
				this.aFeatureUsage.push(oData);
			}
			return oDeferred;
		},

		readGenCustSuccess: function (oData) {
			var oDeferred = $.Deferred();
			if (oData.results) {
				oDeferred.resolve();
				this.aGenCust = oData.results;
			} else {
				oDeferred.resolve();
				this.aGenCust.push(oData);
			}
			return oDeferred;
		},

		readCustomizingSuccess: function (oData, oResponse) {
			var oDeferred = $.Deferred();
			var oCalendar;
			this.oCustomizing = oData;

			if (oData.PlanStyleClass) {
				this.getView().addStyleClass(oData.PlanStyleClass);
			}

			//09.04.2021 Change Anna Grigoran
			//da "cal_timeframe" nicht verwendet wird und zu einem Bug führt, wird standardmäßig immer cal_interval verwendet 
			/*if (!oData.PlanVisCal) {
				oCalendar = this.getView().byId("cal_timeframe");
				oCalendar.setMonths(oData.PlanVisMonths);
				oDeferred.resolve();
			} else {*/
			oCalendar = this.getView().byId("cal_interval");
			oDeferred.resolve();
			// }
			// var date = new Date();
			// var firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
			// //+1 because we need the next month for calculation of days
			// var month = firstDay.getMonth() + 1;
			// var year = firstDay.getYear();
			// var amountDaysMonth = this.daysInMonth(month, year);

			oCalendar.setMinDate(new Date(oData.PlanVisBegda));
			oCalendar.setMaxDate(new Date(oData.PlanVisEndda));
			var oDateRange = new sap.ui.unified.DateRange();

			var oStart = new Date(oData.PlanBegdaDefault);
			var oEnd = new Date(oData.PlanEnddaDefault);
			var oComponentData = this.getOwnerComponent().getComponentData();
			if (oComponentData !== undefined) {
				if (oComponentData.startupParameters.startDate && oComponentData.startupParameters.endDate) {
					oStart = new Date(oComponentData.startupParameters.startDate[0]);
					oEnd = new Date(oComponentData.startupParameters.endDate[0]);
				}
			}
			oDateRange.setStartDate(oStart);
			oDateRange.setEndDate(oEnd);
			// oCalendar.setStartDate(firstDay);
			// oCalendar.setDays(amountDaysMonth);
			this.setShownMonthInCalendar(oCalendar);
			this.getView().getModel("Customizing").setProperty("/StartDate", oStart);
			this.getView().getModel("Customizing").setProperty("/EndDate", oEnd);

			oCalendar.insertSelectedDate(oDateRange);
			this.getView().byId("pnl_timeframe").setExpanded(true);

			//09.04.2021 Change Anna Grigoran
			//da "cal_timeframe" nicht verwendet wird und zu einem Bug führt, wird standardmäßig immer cal_interval verwendet 
			this.getView().byId("cal_interval").setVisible(true); //oData.PlanVisCal);
			this.getView().byId("cal_timeframe").setVisible(false); //!oData.PlanVisCal);

			if (this.isFeatureEnabled("SAVE")) {
				var oSaveButton = this.getView().byId("btnSave");
				oSaveButton.setVisible(true);
				var oCancelButton = this.getView().byId("btnCancel");
				oCancelButton.setVisible(true);
			}
			return oDeferred;
		},

		setShownMonthInCalendar: function (oCalendar, oDate) {
			if (!oDate) {
				oDate = new Date();
			}
			var firstDay = new Date(oDate.getFullYear(), oDate.getMonth(), 1);
			//+1 because we need the next month for calculation of days
			var month = firstDay.getMonth() + 1;
			var year = firstDay.getYear();
			var amountDaysMonth = this.daysInMonth(month, year);

			oCalendar.setStartDate(firstDay);
			oCalendar.setDays(amountDaysMonth);
		},

		onCalStartDateChange: function () {
			var oCalendar = this.getView().byId("cal_interval");
			var date = oCalendar.getStartDate();
			// //we need mid of the date to adjust the issue with the false startDate in relation to different days per month
			date.setDate(date.getDate() + 15);
			var firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
			//+1 because we need the next index for right month calculation
			// var month = firstDay.getMonth() + 1;
			// var year = firstDay.getYear();
			// var amountDaysMonth = this.daysInMonth(month, year);
			// oCalendar.setStartDate(firstDay);
			// oCalendar.setDays(amountDaysMonth);
			this.setShownMonthInCalendar(oCalendar, firstDay);
		},

		daysInMonth: function (month, year) {
			return new Date(year, month, 0).getDate();
		},

		isFeatureEnabled: function (vFeatureKey) {
			for (var i = 0; i < this.aFeatureUsage.length; i++) {
				if (this.aFeatureUsage[i].FeatureKey == vFeatureKey) {
					return this.aFeatureUsage[i].IsActive;
				}
			}
			return false;
		},

		isFeatureFavorite: function (vFeatureKey) {
			for (var i = 0; i < this.aFeatureUsage.length; i++) {
				if (this.aFeatureUsage[i].FeatureKey == vFeatureKey) {
					if (this.aFeatureUsage[i].IsFavorite === true) {
						return true;
					}
				}
			}
		},

		getCustValue: function (sCustName) {
			for (var i = 0; i < this.aGenCust.length; i++) {
				if (this.aGenCust[i].Name == sCustName) {
					return this.aGenCust[i].Value;
				}
			}
			//no value found:
			return null;
		},

		handleError: function (oError, oControl) {
			// var aErrorMsg;
			// if (oControl) {
			// 	oControl.setBusy(false);
			// }
			// if (oError.responseText.match("^<html")) {
			// 	aErrorMsg = jQuery.parseHTML(oError.responseText);
			// } else {
			// 	aErrorMsg = JSON.parse(oError.responseText).error.innererror.errordetails;
			// }

			// for (var i = 0; i < aErrorMsg.length; i++) {
			// 	if (aErrorMsg[i].code == "/IWBEP/CX_MGW_BUSI_EXCEPTION") {
			// 		aErrorMsg.splice(i, 1);
			// 	}
			// }

			// var oModel = oMessagePopover.getModel();
			// var data = oModel.getData();
			// $.extend(data, aErrorMsg);
			// oModel.setData(data);
		},

		handleException: function (oError) {
			var aErrorMsg;

			if (oError.responseText && oError.responseText.match("^<html")) {
				aErrorMsg = jQuery.parseHTML(oError.responseText);
			} else if (JSON.parse(oError.responseText).error) {
				aErrorMsg = JSON.parse(oError.responseText).error.innererror.errordetails;
			} else {
				aErrorMsg = this.getView().getModel("i18n").getResourceModel().getText("error_exception");
			}

			for (var i = 0; i < aErrorMsg.length; i++) {
				if (aErrorMsg[i].code == "/IWBEP/CX_MGW_BUSI_EXCEPTION") {
					aErrorMsg.splice(i, 1);
					continue;
				}
				MessageBox.error(aErrorMsg[i].message);
			}

			var oModel = oMessagePopover.getModel();
			var data = oModel.getData();
			$.extend(data, aErrorMsg);
			oModel.setData(data);
		},

		initializeModel: function () {
			var oModel = this.getView().getModel();
			oModel.setSizeLimit(1000);
		},

		getResourceBundleText: function (sKey) {
			return this.getView().getModel("i18n").getResourceBundle().getText(sKey);
		},

		fillUnitColumns: function (oTable, vUnitKey) {
			var oFilterUnit = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			this.getView().getModel().read("/metaUnitSet", {
				groupId: vUnitKey,
				success: function (oData) {
					this.readMetaUnitSuccess(oTable, vUnitKey, oData);
				}.bind(this),
				error: function (oError) {
					oTable.setBusy(false);
				}.bind(this),
				filters: [oFilterUnit],
				refreshAfterChange: false
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
							press: this.openPopup.bind(this),
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
							// writeToDom: true,
							value: {
								path: aData[i].FieldKey + "/EmpID",
								formatter: Formatter.checkCustomDataIsString
							}
						}));

						oTemplate.addCustomData(new sap.ui.core.CustomData({
							key: "UnitKey",
							// writeToDom: true,
							value: vUnitKey
						}));

						oTemplate.addCustomData(new sap.ui.core.CustomData({
							key: "fragment",
							// writeToDom: true,
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
							press: this.unassignEmployee.bind(this),
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
							// writeToDom: true,
							value: {
								path: aData[i].FieldKey + "/EmpID",
								formatter: Formatter.checkCustomDataIsString
							}
						}));

						oTemplate.addCustomData(new sap.ui.core.CustomData({
							key: "UnitKey",
							// writeToDom: true,
							value: vUnitKey
						}));

						oTemplate.addCustomData(new sap.ui.core.CustomData({
							key: "fragment",
							// writeToDom: true,
							value: {
								path: aData[i].FieldKey + "/fragment",
								formatter: Formatter.checkCustomDataIsString
							}
						}));

						//ColumnType === "TEXT" has same implementation as others so commented
						/*} else if (aData[i].ColumnType === "TEXT") {
						oTemplate = new sap.m.Text({
							text: {
								path: "value"
							},
							tooltip: {
								path: "Tooltip"
							},
							wrapping: false
						});*/
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

					// 26.01.2021 KOBETC: changed binding approach
					// oTemplate.bindElement(aData[i].FieldKey);

					var oMTFI = new sap.ui.unified.MenuTextFieldItem({
						label: "Filter",
						icon: "sap-icon://filter",
						select: this.onColumnFilter.bind(this)
					});

					var oColumn = new sap.ui.table.Column("col_" + vUnitKey + aData[i].FieldKey, {
						template: oTemplate,
						// ariaHasPopup: "Menu",
						autoResizable: true,
						menu: new sap.ui.unified.Menu({
							items: [
								oMTFI
							]
						})
					});

					oMTFI._column = oColumn;
					oMTFI._table = oTable;

					var oUnitLabel = new sap.m.Label("lbl_unit" + vUnitKey + i);

					oUnitLabel.setWidth("1px");

					//TODO: change to dynamic solution (that one is for tests)
					/*if(aData[i].FieldKey === "AUFTR" || aData[i].FieldKey === "BEGUZ" || aData[i].FieldKey === "ENDUZ" || 
						aData[i].FieldKey === "MATNR" || aData[i].FieldKey === "QUAL" || aData[i].FieldKey === "SHFT_TMW" || 
						aData[i].FieldKey === "SHIFT" || aData[i].FieldKey === "SP" || aData[i].FieldKey === "TIMESOVERV" || 
						aData[i].FieldKey === "UNASSIGN") {
						oColumn.setWidth('40px');
					}*/

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
				// oTable.setFixedColumnCount(aData.length);
				oTable._fixedCC = aData.length;
			} else {
				this.readDateUnit(oTable, vUnitKey);
			}
		},

		readDateUnit: function (oTable, vUnitKey) {
			var oModel = this.getView().getModel();
			var oCalendar;

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
			//Wenn nur das Begindatum gewählt ist wollen wir keinen Aufruf ans Backend starten
			if (oBegda && oEndda) {
				var oFilter = new sap.ui.model.Filter("PlanDate", sap.ui.model.FilterOperator.BT, oBegda, oEndda);
				var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

				oModel.read("/commentSet", {
					filters: [oFilter, oUnitFilter],
					success: function (oData) {
						var oCommentModel = this.getOwnerComponent().getModel("Comments");
						oCommentModel.setData(oData, true);
					}.bind(this),
					error: function () {}
				});

				this.getView().getModel().read("/metaDateSet", {
					groupId: vUnitKey,
					filters: [oFilter, oUnitFilter],
					success: function (oData) {
						this.readMetaDateSuccess(oTable, vUnitKey, oData);
					}.bind(this),
					error: function (oData) {
						oTable.setBusy(false);
					}.bind(this),
					// refreshAfterChange: true
					refreshAfterChange: false
				});
			}
		},

		onBeforeRenderTemplate: function (oEvent) {
			var sType = Helper.getCustomDataValue(oEvent.srcControl.getAggregation("customData"), "ColumnType");
			var sOldKey;
			if (sType === "CB") {
				sOldKey = oEvent.srcControl.getSelectedKey();
				oEvent.srcControl.setSelectedKey("");
				oEvent.srcControl.setSelectedKey(sOldKey);
			}
		},

		onAfterRenderTemplate: function (oEvent) {
			var cellId = oEvent.srcControl.getId();

			// setTimeout(function () {
			var vValue = Helper.getCustomDataValue(oEvent.srcControl.getAggregation("customData"), "background");
			$("#" + cellId).parent().parent().css("background-color", vValue);
			// }, 500);

		},

		onAfterRenderQualTemplate: function (oEvent) {
			// setTimeout(function () {
			var cellId = oEvent.srcControl.getId();
			var vValue = Helper.getCustomDataValue(oEvent.srcControl.getAggregation("customData"), "backgroundqual");
			// if (vValue !== "") {
			$("#" + cellId).css("background-color", vValue);
			// }
			// }, 500);
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
							// var cLetter = this.getResourceBundleText("letter");
							oDateLabel.setHtmlText(
								"<p style='color:#03a9f4;text-align:center;font-weight:bolder;margin-block-start:0px;margin-block-end:0px;font-size:1rem'>" +
								aData[i].LabelText /* + cLetter*/ + "</p>");
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
								press: this.openPopup.bind(this),
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
								// writeToDom: true,
								value: {
									path: aData[i].FieldKey + vDate + "/EmpID",
									formatter: Formatter.checkCustomDataIsString
								}
							}));

							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "PlanDate",
								// writeToDom: true,
								value: vDate.toString()
							}));

							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "UnitKey",
								// writeToDom: true,
								value: vUnitKey
							}));

							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "fragment",
								// writeToDom: true,
								value: {
									path: aData[i].FieldKey + vDate + "/fragment",
									formatter: Formatter.checkCustomDataIsString
								}
							}));
							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "ColumnType",
								// writeToDom: true,
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
								// writeToDom: true,
								value: "Text"
							}));

						} else if (aData[i].ColumnType === "CB") {
							oTemplate = new sap.m.ComboBox({
								value: {
									path: aData[i].FieldKey + vDate + "/visiblevalue"
								},
								selectedKey: {
									path: aData[i].FieldKey + vDate + "/value"
								},
								tooltip: {
									path: aData[i].FieldKey + vDate + "/Tooltip"
								},
								visible: {
									parts: [aData[i].FieldKey + vDate + "/visible", "readonly"],
									formatter: function (vValue, readonly) {
										if (vValue === undefined) vValue = true;
										return !(!vValue || readonly);
									}
								},
								editable: {
									parts: [aData[i].FieldKey + vDate + "/disabled", "readonly"],
									formatter: function (vValue, readonly) {
										if (vValue === undefined) vValue = true;
										return !(vValue || readonly);
									}
								},
								change: this.onCBSubmit.bind(this),
								width: "5rem" // ursprünglich 4rem
							});

							this._oDataUtil.getItems(aData[i].FieldKey, vUnitKey, oTemplate).then(function (oResult) {
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
								// writeToDom: true,
								value: {
									path: aData[i].FieldKey + vDate + "/EmpID",
									formatter: Formatter.checkCustomDataIsString
								}
							}));

							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "PlanDate",
								// writeToDom: true,
								value: vDate.toString()
							}));
							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "FieldKey",
								// writeToDom: true,
								value: aData[i].FieldKey
							}));
							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "defKey",
								// writeToDom: true,
								value: {
									path: aData[i].FieldKey + vDate + "/value",
									mode: "OneTime",
									formatter: Formatter.checkCustomDataIsString
								}
							}));
							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "UnitKey",
								// writeToDom: true,
								value: vUnitKey
							}));
							oTemplate.addCustomData(new sap.ui.core.CustomData({
								key: "ColumnType",
								// writeToDom: true,
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
								// writeToDom: true,
								value: "Text"
							}));
						}

						/*oTemplate.addEventDelegate({
							onBeforeRendering: this.onBeforeRenderTemplate
						});

						oTemplate.addEventDelegate({
							onAfterRendering: this.onAfterRenderTemplate
						});*/

						oTemplate.addCustomData(new sap.ui.core.CustomData({
							key: "background",
							writeToDom: true,
							value: {
								path: aData[i].FieldKey + vDate + "/color",
								formatter: Formatter.checkCustomDataIsString
							}
						}));

						// 26.01.2021 KOBETC: changed binding approach
						// oTemplate.bindElement(aData[i].FieldKey + vDate);

						var oMenu = new sap.ui.unified.Menu();

						var oMTFI = new sap.ui.unified.MenuTextFieldItem({
							label: "Filter",
							icon: "sap-icon://filter",
							select: this.onColumnFilter.bind(this)
						});

						oMenu.addItem(oMTFI);

						var oColumn = new sap.ui.table.Column("Dcol_" + vUnitKey + aData[i].FieldKey + vDate, {
							template: oTemplate,
							// ariaHasPopup: "Menu",
							autoResizable: true,
							menu: oMenu
						});

						if (this.isFeatureEnabled("COMMENT")) {
							var oMI = new sap.ui.unified.MenuItem({
								text: "{i18n>comments}",
								icon: "sap-icon://comment",
								select: this.onColumnSelect.bind(this)
							});
							oMenu.addItem(oMI);
							oMI._column = oColumn;
						}

						oMTFI._column = oColumn;
						oMTFI._table = oTable;

						//TODO: change to dynamic solution (that one is for tests)
						/*if(aData[i].FieldKey === "AUFTR" || aData[i].FieldKey === "BEGUZ" || aData[i].FieldKey === "ENDUZ" || 
							aData[i].FieldKey === "MATNR" || aData[i].FieldKey === "QUAL" || aData[i].FieldKey === "SHFT_TMW" || 
							aData[i].FieldKey === "SHIFT" || aData[i].FieldKey === "SP" || aData[i].FieldKey === "TIMESOVERV" || 
							aData[i].FieldKey === "UNASSIGN") {
							oColumn.setWidth('40px');
						}*/

						oColumn.addCustomData(new sap.ui.core.CustomData({
							key: "UnitKey",
							// writeToDom: true,
							value: vUnitKey
						}));

						oColumn.addCustomData(new sap.ui.core.CustomData({
							key: "PlanDate",
							// writeToDom: true,
							value: vDate.toString()
						}));

						if (aData[i].DateColor) {
							oColumn.addCustomData(new sap.ui.core.CustomData({
								key: "header-background",
								writeToDom: true,
								value: aData[i].DateColor
							}));
							this.libtables.addHeaderCssColoring(aData[i].DateColor);
						}

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

		checkItemsExist: function (vFieldKey) {
			if (!this.aItems) {
				return false;
			}
			var oItem = {};
			for (var i = 0; i < this.aItems.length; i++) {
				oItem = this.aItems[i];
				if (oItem.FieldKey == vFieldKey) {
					return true;
				}
			}
			return false;
		},

		getItems: function (oParams) {
			var vFieldKey = oParams.fieldKey;
			var oComboBox = oParams.comboBox;
			var oFilter = new sap.ui.model.Filter("FieldKey", "EQ", vFieldKey);
			var vUnitKey = oParams.unitKey;
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oItem = {};
			if (!this.aItems || !this.checkItemsExist(vFieldKey)) {
				this.getView().getModel().read("/valueHelpSet", {
					filters: [oFilter, oUnitFilter],
					success: function (oData, oResponse) {
						this.aItems = [];
						for (var i = 0; i < oData.results.length; i++) {
							oItem = oData.results[i];
							oComboBox.addItem(new sap.ui.core.Item({
								key: oItem.ItemKey,
								text: oItem.ItemValue
							}));

							this.aItems.push(oItem);
						}
					}.bind(this),
					error: this.handleError.bind(this)
				});
			} else {
				for (var i = 0; i < this.aItems.length; i++) {
					oItem = this.aItems[i];
					if (oItem.FieldKey == vFieldKey) {
						oComboBox.addItem(new sap.ui.core.Item({
							key: oItem.ItemKey,
							text: oItem.ItemValue
						}));
					}
				}
			}
		},

		onCBSubmit: function (oEvent) {
			if (!oEvent.getSource().getSelectedKey()) {
				oEvent.getSource().setSelectedKey(Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "defKey"));
			} else {
				if (!this.getView().getModel("CBData")) {
					var oModel = new sap.ui.model.json.JSONModel();
					oModel.setData([]);
					this.getView().setModel(oModel, "CBData");
				}
				var aData = this.getView().getModel("CBData").getData();
				var dPlanDate = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "PlanDate");
				dPlanDate = typeof (dPlanDate) === "string" ? parseInt(dPlanDate) : dPlanDate;

				oEvent.getSource().setTooltip(oEvent.getSource().getSelectedItem().getTooltip());
				aData.push({
					EmpId: Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "EmpId"),
					PlanDate: dPlanDate,
					Value: oEvent.getSource().getSelectedKey(),
					FieldKey: Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "FieldKey"),
					UnitKey: Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "UnitKey")
				});
				this.getView().getModel("CBData").setData(aData);
			}
		},

		openPopup: function (oEvent) {
			var vFragment;
			var aCustomData = oEvent.getSource().getAggregation("customData");
			for (var i = 0; i < aCustomData.length; i++) {
				if (aCustomData[i].getProperty("key") === "fragment") {
					vFragment = aCustomData[i].getProperty("value");
				}
			}
			switch (vFragment) {
			case "AbsencePick":
				this.openAbsencePopup(oEvent);
				break;
			case "QualPick":
				this.openQualPopup(oEvent);
				break;
			case "EmployeeData":
				this.openEmpDataPopup(oEvent);
				break;
			case "TimesOverview":
				this.openTimeOverviewPopupWrapper(oEvent);
				break;
			case "ChangePlanTimes":
				this.onOpenChangePlanTime(oEvent);
				break;
			case "ChangeUnit":
				this.onOpenChangeUnit(oEvent);
				break;
			default:
				return;
			}
		},

		openAbsencePopup: function (oEvent) {
			if (!this._absenceDialog) {
				this._absenceDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.AbsencePick", this);
			}
			var vDate = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "PlanDate");
			vDate = typeof (vDate) === "string" ? parseInt(vDate) : vDate;
			var vEmpID = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "EmpID");
			var vUnitKey = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "UnitKey");
			var oDate = new Date(vDate);
			this.getView().addDependent(this._absenceDialog);
			this._absenceDialog.destroyItems();
			this._absenceDialog.setBusyIndicatorDelay(0);
			this._absenceDialog.setBusy(true);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oEmpFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpID);
			var oGanztaegigFilter = new sap.ui.model.Filter("Ganztaegig", sap.ui.model.FilterOperator.EQ, "true");

			var oTemplate = new sap.m.StandardListItem({
				title: "{SubtyText}"
			});

			oTemplate.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));

			oTemplate.addEventDelegate({
				onAfterRendering: this.onAfterRenderQualTemplate
			});

			oTemplate.addCustomData(new sap.ui.core.CustomData({
				key: "SubType",
				// writeToDom: true,
				value: "{Subty}"
			}));

			oTemplate.addCustomData(new sap.ui.core.CustomData({
				key: "EmpID",
				// writeToDom: true,
				value: vEmpID
			}));

			oTemplate.addCustomData(new sap.ui.core.CustomData({
				key: "PlanDate",
				// writeToDom: true,
				value: vDate.toString()
			}));

			oTemplate.addCustomData(new sap.ui.core.CustomData({
				key: "ButtonId",
				// writeToDom: true,
				value: oEvent.getSource().getId()
			}));

			oTemplate.addCustomData(new sap.ui.core.CustomData({
				key: "Infty",
				// writeToDom: true,
				value: "{Infty}"
			}));

			var oModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/MIND2/PEP_YEAR_SRV");
			this._absenceDialog.setModel(oModel);
			this._absenceDialog.bindAggregation("items", {
				path: "/SubtypSet",
				filters: [oEmpFilter, oUnitFilter, oGanztaegigFilter],
				template: oTemplate,
				events: {
					dataReceived: function () {
						this._absenceDialog.setBusy(false);
					}.bind(this)
				}
			});

			this._absenceDialog.open();
		},

		openQualPopup: function (oEvent) {

			var vDate = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "PlanDate");
			vDate = typeof (vDate) === "string" ? parseInt(vDate) : vDate;
			var vEmpID = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "EmpID");
			var vUnitKey = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "UnitKey");
			var oDate = new Date(vDate);
			var oModel = this.getView().getModel();

			var oFragmentController = new FragmentQualPick(this, vUnitKey, vEmpID, vDate);

			if (!this._qualDialog) {
				this._qualDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.QualPick", oFragmentController, {
					refreshAfterChange: true
				});
			}

			this.getView().addDependent(this._qualDialog);
			// this._qualDialog.destroyItems();
			this._qualDialog.setBusyIndicatorDelay(0);
			// this._qualDialog.setBusy(true);
			this._qualDialog.setModel(oModel);

			var oDateFilter = new sap.ui.model.Filter("PlanDate", sap.ui.model.FilterOperator.EQ, oDate);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oEmpFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpID);

			var aFilter = [];
			aFilter.push(oDateFilter);
			aFilter.push(oEmpFilter);
			aFilter.push(oUnitFilter);

			var oTemplate = new sap.m.CheckBox({
				text: "{QualText} ({QualAbbr})",
				selected: "{Assigned}"
			});

			sap.ui.getCore().byId("vb_qual_pick_id").bindAggregation("items", {
				path: "/functionSet",
				template: oTemplate,
				filters: aFilter,
				events: {
					dataReceived: function (oData) {

					}.bind(this)
				}
			});

			this._qualDialog.open();

			// var oTemplate = new sap.m.StandardListItem({
			// 	title: "{QualText}"
			// });

			// oTemplate.addCustomData(new sap.ui.core.CustomData({
			// 	key: "UnitKey",
			// 	writeToDom: true,
			// 	value: vUnitKey
			// }));

			// oTemplate.addEventDelegate({
			// 	onAfterRendering: this.onAfterRenderQualTemplate
			// });

			// oTemplate.addCustomData(new sap.ui.core.CustomData({
			// 	key: "backgroundqual",
			// 	writeToDom: true,
			// 	value: {
			// 		path: "ListColor"
			// 	}
			// }));

			// oTemplate.addCustomData(new sap.ui.core.CustomData({
			// 	key: "QualId",
			// 	writeToDom: true,
			// 	value: "{QualId}"
			// }));

			// oTemplate.addCustomData(new sap.ui.core.CustomData({
			// 	key: "EmpID",
			// 	writeToDom: true,
			// 	value: vEmpID
			// }));

			// oTemplate.addCustomData(new sap.ui.core.CustomData({
			// 	key: "PlanDate",
			// 	writeToDom: true,
			// 	value: vDate
			// }));

			// oTemplate.addCustomData(new sap.ui.core.CustomData({
			// 	key: "ButtonId",
			// 	writeToDom: true,
			// 	value: oEvent.getSource().getId()
			// }));

			// this._qualDialog.bindAggregation("items", {
			// 	path: "/qualificationSet",
			// 	filters: [oEmpFilter, oUnitFilter, oDateFilter],
			// 	template: oTemplate,
			// 	events: {
			// 		dataReceived: function () {
			// 			this._qualDialog.setBusy(false);
			// 		}.bind(this)
			// 	}
			// });

		},

		openEmpDataPopup: function (oEvent) {
			if (!this._empDataDialog) {
				this._empDataDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.EmployeeData", this);
				this._empDataDialog.attachAfterClose(this.destroyEmpDataDialog.bind(this));
			}
			var oModel = this.getView().getModel();
			var vEmpID = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "EmpID");
			var vUnitKey = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "UnitKey");

			this.getView().addDependent(this._empDataDialog);
			this._empDataDialog.setBusyIndicatorDelay(0);
			this._empDataDialog.setBusy(true);

			var oEmpFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpID);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.BT, this.getSelectedBegda(), this.getSelectedEndda());

			this._empDataDialog.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));

			this._empDataDialog.addCustomData(new sap.ui.core.CustomData({
				key: "EmpId",
				// writeToDom: true,
				value: vEmpID
			}));

			oModel.read("/empProfileSet", {
				success: function (oData, oResponse) {
					this.readEmpProfileSuccess(oData);
				}.bind(this),
				error: this.handleError.bind(this),
				filters: [oEmpFilter, oUnitFilter, oBegdaFilter],
				refreshAfterChange: true
			});

		},

		readEmpProfileSuccess: function (oData) {
			var aData = oData.results;
			var oSimpleForm = sap.ui.getCore().byId("sf_formEmployeeData");
			oSimpleForm.setEditable(true);
			oSimpleForm.setLayout("GridLayout");
			var vCategory;
			var vDropDownBuilt;
			for (var i = 0; i < aData.length; i++) {
				if (vCategory != aData[i].Category) {
					if (vCategory) {
						oSimpleForm.addContent(oCategoryForm);
					}
					vCategory = aData[i].Category;

					if (!aData[i].IsDropdown) {
						var oCategoryForm = new sap.ui.layout.form.SimpleForm("sf_" + aData[i].Category);
						oCategoryForm.setTitle(aData[i].TextCategory);
					} else if (!vDropDownBuilt) {
						var oHeader = new sap.m.Toolbar("tb_empProfile");
						var oSelect = new sap.m.Select("sel_empProfile", {
							width: "12rem",
							change: this.onChangeEmpProfile.bind(this)
						});
						oHeader.addContent(oSelect);
						var oCategoryForm = new sap.ui.layout.form.SimpleForm("sf_" + aData[i].Category, {
							toolbar: oHeader
						});
						var oItem = new sap.ui.core.Item({
							text: aData[i].TextCategory,
							key: aData[i].Category
						});
						oSelect.addItem(oItem);
						vDropDownBuilt = true;
						oSelect.setSelectedKey(aData[i].Category);
					} else {
						var oItem = new sap.ui.core.Item({
							text: aData[i].TextCategory,
							key: aData[i].Category
						});
						oSelect.addItem(oItem);
					}

				}
				if (oCategoryForm.getTitle() == aData[i].TextCategory || (vDropDownBuilt && oSelect.getSelectedKey() == aData[i].Category)) {
					var oFieldLabel = new sap.m.Label("lbl_" + "field" + aData[i].Field);

					oFieldLabel.setText(aData[i].TextField);
					oCategoryForm.addContent(oFieldLabel);
					var oFieldText = new sap.m.Text("txt_" + "data" + aData[i].Field);
					oFieldText.setText(aData[i].Value);

					oCategoryForm.addContent(oFieldText);
				}

			}
			if (vCategory) {
				oSimpleForm.addContent(oCategoryForm);
			}
			this._empDataDialog.setBusy(false);
			this._empDataDialog.open();
		},

		onChangeEmpProfile: function (oEvent) {
			this._empDataDialog.setBusy(true);
			var oModel = this.getView().getModel();
			var vUnitKey = Helper.getCustomDataValue(this._empDataDialog.getAggregation("customData"), "UnitKey");
			var vEmpId = Helper.getCustomDataValue(this._empDataDialog.getAggregation("customData"), "EmpId");
			var vCategory = oEvent.getSource().getSelectedKey();

			var oCategoryFilter = new sap.ui.model.Filter("Category", sap.ui.model.FilterOperator.EQ, vCategory);

			var oEmpFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.BT, this.getSelectedBegda(), this.getSelectedEndda());
			oModel.read("/empProfileSet", {
				success: function (oData, oResponse) {
					this.changeEmpProfileSuccess(oData);
					this._empDataDialog.setBusy(false);
				}.bind(this),
				error: this.handleError.bind(this),
				filters: [oEmpFilter, oUnitFilter, oBegdaFilter, oCategoryFilter],
				refreshAfterChange: true
			});
		},

		changeEmpProfileSuccess: function (oData) {
			var aData = oData.results;
			var oToolbar = sap.ui.getCore().byId("tb_empProfile");
			var oCategoryForm = oToolbar.getParent().getParent();
			oCategoryForm.destroyContent();

			for (var i = 0; i < aData.length; i++) {
				var oFieldLabel = new sap.m.Label("lbl_" + "field" + aData[i].Field);

				oFieldLabel.setText(aData[i].TextField);
				oCategoryForm.addContent(oFieldLabel);
				var oFieldText = new sap.m.Text("txt_" + "data" + aData[i].Field);
				oFieldText.setText(aData[i].Value);

				oCategoryForm.addContent(oFieldText);
			}
		},

		onOpenChangePlanTime: function (oEvent) {
			if (!this._oChangePlanTimeDialog) {
				this._oChangePlanTimeDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.ChangePlanTimes", this, {
					refreshAfterChange: true
				});
				this._oChangePlanTimeDialog.attachAfterClose(this.destroyChangePlanTimeDialog.bind(this));
			}
			this.getView().addDependent(this._oChangePlanTimeDialog);

			var oModel = this.getView().getModel();
			var vDate = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "PlanDate");
			vDate = typeof (vDate) === "string" ? parseInt(vDate) : vDate;
			var vEmpId = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "EmpID");
			var vUnitKey = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "UnitKey");
			var oDate = new Date(vDate);
			var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "yyyyMMdd"
			});
			var vDateFormatted = oDateFormat.format(oDate);
			var vShiftKey = vEmpId + vDateFormatted + vUnitKey;

			oModel.read("/empShiftSet(EmpId='" + vEmpId + "',ShiftDate='" + vDateFormatted + "',ShiftKey='" + vShiftKey + "')", {
				success: this.getPlanTimeSetSuccess.bind(this),
				error: this.handleError.bind(this),
				refreshAfterChange: true
			});

			var oButton = sap.ui.getCore().byId("btn_saveplantime");
			oButton.addCustomData(new sap.ui.core.CustomData({
				key: "PlanDate",
				// writeToDom: true,
				value: vDateFormatted.toString()
			}));
			oButton.addCustomData(new sap.ui.core.CustomData({
				key: "EmpId",
				// writeToDom: true,
				value: vEmpId
			}));
			oButton.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));

			var oButtonDel = sap.ui.getCore().byId("btn_deleteplantime");
			oButtonDel.addCustomData(new sap.ui.core.CustomData({
				key: "PlanDate",
				// writeToDom: true,
				value: vDateFormatted.toString()
			}));
			oButtonDel.addCustomData(new sap.ui.core.CustomData({
				key: "EmpId",
				// writeToDom: true,
				value: vEmpId
			}));
			oButtonDel.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));

			this._oChangePlanTimeDialog.open();
		},

		getPlanTimes: function (oData) {
			var oModel = this.getView().getModel();
			var vEmpId = oData.EmpId;
			var vDateFormatted = oData.ShiftDate;
			var vUnitKey = oData.UnitKey;
			var vShiftKey = vEmpId + vDateFormatted + vUnitKey;
			oModel.read("/empShiftSet(EmpId='" + vEmpId + "',ShiftDate='" + vDateFormatted + "',ShiftKey='" + vShiftKey + "')", {
				success: this.getPlanTimeSetSuccess.bind(this),
				error: this.handleError.bind(this),
				refreshAfterChange: true
			});
		},

		getPlanTimeSetSuccess: function (oData) {
			sap.ui.getCore().byId("ld_tp_beguz").setValue(oData.OwnBeguz);
			sap.ui.getCore().byId("ld_tp_enduz").setValue(oData.OwnEnduz);
			sap.ui.getCore().byId("ld_tp_newbeguz").setValue("");
			sap.ui.getCore().byId("ld_tp_newenduz").setValue("");
			sap.ui.getCore().byId("ld_tp_beguz_break1").setValue("");
			sap.ui.getCore().byId("ld_tp_enduz_break1").setValue("");
			sap.ui.getCore().byId("ld_tp_beguz_break2").setValue("");
			sap.ui.getCore().byId("ld_tp_enduz_break2").setValue("");
		},

		destroyChangePlanTimeDialog: function (oEvent) {
			this._oChangePlanTimeDialog.destroy();
			this._oChangePlanTimeDialog = null;
		},

		onCloseChangePlanTime: function (oEvent) {
			this._oChangePlanTimeDialog.close();
		},

		onSaveNewPlanTime: function (oEvent) {
			var oModel = this.getView().getModel();
			var oBeguzShift = sap.ui.getCore().byId("ld_tp_newbeguz");
			var vBeguzShift = oBeguzShift.getValue();
			var oEnduzShift = sap.ui.getCore().byId("ld_tp_newenduz");
			var vEnduzShift = oEnduzShift.getValue();
			var oBeguzBreak1 = sap.ui.getCore().byId("ld_tp_beguz_break1");
			var vBeguzBreak1 = oBeguzBreak1.getValue();
			var oEnduzBreak1 = sap.ui.getCore().byId("ld_tp_enduz_break1");
			var vEnduzBreak1 = oEnduzBreak1.getValue();
			var oBeguzBreak2 = sap.ui.getCore().byId("ld_tp_beguz_break2");
			var vBeguzBreak2 = oBeguzBreak2.getValue();
			var oEnduzBreak2 = sap.ui.getCore().byId("ld_tp_enduz_break2");
			var vEnduzBreak2 = oEnduzBreak2.getValue();

			if (this.planTimeValidation()) {
				if (vBeguzBreak1 == "") {
					vBeguzBreak1 = "00000";
				}
				if (vEnduzBreak1 == "") {
					vEnduzBreak1 = "00000";
				}
				if (vBeguzBreak2 == "") {
					vBeguzBreak2 = "00000";
				}
				if (vEnduzBreak2 == "") {
					vEnduzBreak2 = "00000";
				}
				var vDateFormatted = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "PlanDate");
				// vDate = typeof (vDate) === "string" ? parseInt(vDate) : vDate;
				var vEmpId = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "EmpId");
				var vUnitKey = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "UnitKey");
				var oRecord = {};
				oRecord.EmpId = vEmpId;
				oRecord.UnitKey = vUnitKey;
				oRecord.NewShiftKey = vEmpId + vDateFormatted + vBeguzShift + vEnduzShift + vBeguzBreak1 + vEnduzBreak1 + vBeguzBreak2 +
					vEnduzBreak2;
				oRecord.ShiftDate = vDateFormatted;

				oModel.create("/empShiftSet", oRecord, {
					refreshAfterChange: true,
					success: function () {
						this.newPlanTimeSuccess(oRecord, this.getPlanTimes(oRecord));
					}.bind(this),
					error: function (oError) {
						this.createError(oError);
					}.bind(this)
				});
			}

		},

		planTimeValidation: function () {
			var oBeguzShift = sap.ui.getCore().byId("ld_tp_newbeguz");
			var vBeguzShift = oBeguzShift.getValue();
			var oEnduzShift = sap.ui.getCore().byId("ld_tp_newenduz");
			var vEnduzShift = oEnduzShift.getValue();
			var oBeguzBreak1 = sap.ui.getCore().byId("ld_tp_beguz_break1");
			var vBeguzBreak1 = oBeguzBreak1.getValue();
			var oEnduzBreak1 = sap.ui.getCore().byId("ld_tp_enduz_break1");
			var vEnduzBreak1 = oEnduzBreak1.getValue();
			var oBeguzBreak2 = sap.ui.getCore().byId("ld_tp_beguz_break2");
			var vBeguzBreak2 = oBeguzBreak2.getValue();
			var oEnduzBreak2 = sap.ui.getCore().byId("ld_tp_enduz_break2");
			var vEnduzBreak2 = oEnduzBreak2.getValue();

			if (vBeguzShift && vEnduzShift) {
				oBeguzShift.setValueState(sap.ui.core.ValueState.None);
				oEnduzShift.setValueState(sap.ui.core.ValueState.None);
				if (vBeguzShift > vEnduzShift) {
					oBeguzShift.setValueState(sap.ui.core.ValueState.Error);
					oEnduzShift.setValueState(sap.ui.core.ValueState.Error);
					return false;
				}
				if (vBeguzBreak1 && !vEnduzBreak1) {
					oEnduzBreak1.setValueState(sap.ui.core.ValueState.Error);
					return false;
				} else {
					oEnduzBreak1.setValueState(sap.ui.core.ValueState.None);
				}
				if (vEnduzBreak1 && !vBeguzBreak1) {
					oBeguzBreak1.setValueState(sap.ui.core.ValueState.Error);
					return false;
				} else {
					oBeguzBreak1.setValueState(sap.ui.core.ValueState.None);
				}
				if (vBeguzBreak1 > vEnduzBreak1) {
					oBeguzBreak1.setValueState(sap.ui.core.ValueState.Error);
					oEnduzBreak1.setValueState(sap.ui.core.ValueState.Error);
					return false;
				} else {
					oBeguzBreak1.setValueState(sap.ui.core.ValueState.None);
					oEnduzBreak1.setValueState(sap.ui.core.ValueState.None);
				}
				if (vBeguzBreak2 && !vEnduzBreak2) {
					oEnduzBreak2.setValueState(sap.ui.core.ValueState.Error);
					return false;
				} else {
					oEnduzBreak2.setValueState(sap.ui.core.ValueState.None);
				}
				if (vEnduzBreak2 && !vBeguzBreak2) {
					oBeguzBreak1.setValueState(sap.ui.core.ValueState.Error);
					return false;
				} else {
					oBeguzBreak2.setValueState(sap.ui.core.ValueState.None);
				}
				if (vBeguzBreak2 > vEnduzBreak2) {
					oBeguzBreak1.setValueState(sap.ui.core.ValueState.Error);
					oEnduzBreak1.setValueState(sap.ui.core.ValueState.Error);
					return false;
				} else {
					oBeguzBreak1.setValueState(sap.ui.core.ValueState.None);
					oEnduzBreak1.setValueState(sap.ui.core.ValueState.None);
				}
			} else if (vBeguzShift && !vEnduzShift) {
				oBeguzShift.setValueState(sap.ui.core.ValueState.None);
				oEnduzShift.setValueState(sap.ui.core.ValueState.Error);
				return false;
			} else if (!vBeguzShift && vEnduzShift) {
				oBeguzShift.setValueState(sap.ui.core.ValueState.Error);
				oEnduzShift.setValueState(sap.ui.core.ValueState.None);
				return false;
			} else {
				oBeguzShift.setValueState(sap.ui.core.ValueState.Error);
				oEnduzShift.setValueState(sap.ui.core.ValueState.Error);
				return false;
			}
			return true;
		},

		newPlanTimeSuccess: function () {
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vPlanTimeCreated = oResourceBundle.getText("newplantimecreated");
			MessageBox.success(vPlanTimeCreated);
		},

		onDeletePlanTime: function (oEvent) {
			var oModel = this.getView().getModel();
			var vDateFormatted = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "PlanDate");
			// vDate = typeof(vDate) === "string" ? parseInt(vDate) : vDate;
			var vEmpId = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "EmpId");
			var vUnitKey = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "UnitKey");
			var oRecord = {};
			oRecord.EmpId = vEmpId;
			oRecord.UnitKey = vUnitKey;
			oRecord.ShiftDate = vDateFormatted;

			oModel.remove("/empShiftSet(EmpId='" + vEmpId + "',ShiftDate='" + vDateFormatted + "',ShiftKey='" + vEmpId +
				vDateFormatted +
				vUnitKey + "')", {
					refreshAfterChange: true,
					success: function () {
						this.deletePlanTimeSuccess(oRecord, this.getPlanTimes(oRecord));
					}.bind(this),
					error: function (oError) {
						this.createError(oError);
					}.bind(this)
				});
		},

		deletePlanTimeSuccess: function (oEvent) {
			sap.ui.getCore().byId("ld_tp_beguz").setValue(oEvent.OwnBeguz);
			sap.ui.getCore().byId("ld_tp_enduz").setValue(oEvent.OwnEnduz);
			sap.ui.getCore().byId("ld_tp_newbeguz").setValue("");
			sap.ui.getCore().byId("ld_tp_newenduz").setValue("");
			sap.ui.getCore().byId("ld_tp_beguz_break1").setValue("");
			sap.ui.getCore().byId("ld_tp_enduz_break1").setValue("");
			sap.ui.getCore().byId("ld_tp_beguz_break2").setValue("");
			sap.ui.getCore().byId("ld_tp_enduz_break2").setValue("");
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vPlanTimeDeleted = oResourceBundle.getText("plantimedeleted");
			MessageBox.success(vPlanTimeDeleted);
		},

		onSelectQual: function (oEvent) {
			var oItem = oEvent.getParameter("selectedItem");
			var aCustomData = oItem.getAggregation("customData");
			var vUnitKey = Helper.getCustomDataValue(aCustomData, "UnitKey");

			var vDate = Helper.getCustomDataValue(aCustomData, "PlanDate");
			vDate = typeof (vDate) === "string" ? parseInt(vDate) : vDate;
			var vEmpId = Helper.getCustomDataValue(aCustomData, "EmpID");
			var vQualId = Helper.getCustomDataValue(aCustomData, "QualId");
			var vButtonId = Helper.getCustomDataValue(aCustomData, "ButtonId");
			var oDate = new Date(vDate);
			var oEntry = {};
			oEntry.UnitKey = vUnitKey;
			oEntry.EmpId = vEmpId;
			oEntry.PlanDate = oDate;
			oEntry.QualId = vQualId;
			this.getView().getModel().create("/qualificationSet", oEntry, {
				refreshAfterChange: true,
				success: function () {
					sap.ui.getCore().byId(vButtonId).setText(oItem.getTitle());
					sap.ui.getCore().byId(vButtonId).setTooltip(oItem.getTitle());
				}
			});
		},

		onSelectAbsence: function (oEvent) {
			var oItem = oEvent.getParameter("selectedItem");
			var aCustomData = oItem.getAggregation("customData");
			var vDate = Helper.getCustomDataValue(aCustomData, "PlanDate");
			vDate = typeof (vDate) === "string" ? parseInt(vDate) : vDate;
			var vEmpId = Helper.getCustomDataValue(aCustomData, "EmpID");
			var vInfty = Helper.getCustomDataValue(aCustomData, "Infty");
			var vSubty = Helper.getCustomDataValue(aCustomData, "SubType");
			var vButtonId = Helper.getCustomDataValue(aCustomData, "ButtonId");
			var vUnitKey = Helper.getCustomDataValue(aCustomData, "UnitKey");
			var oBeguz = sap.ui.getCore().byId("ld_tp_beguz_leave");
			var oEnduz = sap.ui.getCore().byId("ld_tp_enduz_leave");
			var vSprps;
			if (sap.ui.getCore().byId("chb_sprps")) {
				vSprps = sap.ui.getCore().byId("chb_sprps").getSelected();
			}

			if (oBeguz) {
				var vBeguz = oBeguz.getValue();
			} else {
				var vBeguz = "000000";
			}
			if (oEnduz) {
				var vEnduz = oEnduz.getValue();
			} else {
				var vEnduz = "000000";
			}

			var oDate = new Date(vDate);

			var vBegdaYear = oDate.getYear() + 1900;
			var vEnddaYear = oDate.getYear() + 1900;
			var vBegdaMonth = oDate.getMonth() + 1;

			if (vBegdaMonth.toString().length == 1) {
				vBegdaMonth = "0" + vBegdaMonth;
			}

			var vEnddaMonth = oDate.getMonth() + 1;

			if (vEnddaMonth.toString().length == 1) {
				vEnddaMonth = "0" + vEnddaMonth;
			}

			var vBegdaDay = oDate.getDate();
			if (vBegdaDay.toString().length == 1) {
				vBegdaDay = "0" + vBegdaDay;
			}

			var vEnddaDay = oDate.getDate();
			if (vEnddaDay.toString().length == 1) {
				vEnddaDay = "0" + vEnddaDay;
			}

			var vKey = vEmpId + vInfty + vSubty + vBegdaYear + vBegdaMonth + vBegdaDay + vEnddaYear + vEnddaMonth + vEnddaDay + vBeguz +
				vEnduz + vSprps + vUnitKey;
			var oRecord = {};
			oRecord.LeaveKey = vKey;
			var oModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/MIND2/PEP_YEAR_SRV", {
				refreshAfterChange: true
			});
			oModel.create("/AbsenceSet", oRecord, {
				refreshAfterChange: true,
				success: function () {
					sap.ui.getCore().byId(vButtonId).setText(oItem.getTitle());
					sap.ui.getCore().byId(vButtonId).setTooltip(oItem.getTitle());
				},
				error: this.createError.bind(this)
			});
		},

		removeColumns: function (oTable, vPrefix) {
			var aColumns = oTable.getColumns();
			for (var i = 0; i < aColumns.length; i++) {
				if (aColumns[i].getId().substring(0, vPrefix.length) === vPrefix) {
					oTable.removeColumn(aColumns[i]);
					var aLabels = aColumns[i].getMultiLabels();
					if (aLabels.length > 0) {
						for (var j = 0; j < aLabels.length; j++) {
							if (aLabels[i]) {
								aLabels[i].destroy();
							}
						}
					} else {
						aColumns[i].getLabel().destroy();
					}
					aColumns[i].getTemplate().destroy();
					aColumns[i].destroy();
				}
			}
		},

		onCalendarSelect: function (oEvent) {
			var oSelectedWeek = $('.selectedWeek')[0];
			if (oSelectedWeek) {
				oSelectedWeek.classList.remove('selectedWeek');
			}
			if (oEvent.getSource().getSelectedDates()[0].getStartDate() && oEvent.getSource().getSelectedDates()[0].getEndDate()) {
				this.refreshAllTables();
				//WORKAROUND: In 1.52 calendar destroys weeks instead of rerendering them
				var oCal = this.byId('cal_interval');
				setTimeout(function () {
					Helper.attachCalendarWeekSelection($('.sapUiCalRowWeekNumbers')[0], oCal);
				}, 500);

				this.getView().getModel("Customizing").setProperty("/StartDate", oEvent.getSource().getSelectedDates()[0].getStartDate());
				this.getView().getModel("Customizing").setProperty("/EndDate", oEvent.getSource().getSelectedDates()[0].getEndDate());
			}
		},

		refreshAllTables: function () {
			for (var i = 0; i < this.aUnits.length; i++) {
				this.fillTablesForUnit(this.aUnits[i].UnitKey);
			}
		},

		onDatePickerChange: function (oEvent) {
			var oCustModel = this.getView().getModel("Customizing"),
				dBegda = oCustModel.getProperty("/StartDate"),
				dEndda = oCustModel.getProperty("/EndDate"),
				oCalendar;
			oEvent.getSource().setValueState(sap.ui.core.ValueState.None);
			if (!dBegda || !dEndda) {
				return;
			}
			if (dBegda > dEndda) {
				return;
			}
			if (this.getView().byId("cal_timeframe").getVisible()) {
				oCalendar = this.getView().byId("cal_timeframe");
			} else {
				oCalendar = this.getView().byId("cal_interval");
			}

			if (!oCalendar.getSelectedDates()[0]) {
				return;
			}

			oCalendar.getSelectedDates()[0].setStartDate(dBegda);
			oCalendar.getSelectedDates()[0].setEndDate(dEndda);

			this.setShownMonthInCalendar(oCalendar, dBegda);
			oCalendar.fireSelect();
		},

		getSelectedBegda: function (vId) {
			var oCalendar;
			if (vId == null || vId == undefined) {
				if (this.getView().byId("cal_timeframe").getVisible()) {
					oCalendar = this.getView().byId("cal_timeframe");
				} else {
					oCalendar = this.getView().byId("cal_interval");
				}

			} else {
				oCalendar = sap.ui.getCore().byId(vId);
			}
			var aSelectedDates = oCalendar.getSelectedDates();
			if (aSelectedDates.length > 0 && aSelectedDates[0].getStartDate() !== null && aSelectedDates[0].getEndDate() !== null) {
				var oBegda1 = aSelectedDates[0].getStartDate();
				var oBegda = new Date(oBegda1);
				oBegda.setHours(12);
				return oBegda;
			}
		},

		getSelectedEndda: function (vId) {
			var oCalendar;
			if (vId == null || vId == undefined) {
				//22.05.2019 Yannick Anpassung an verschiedene Kalender BEG
				if (this.getView().byId("cal_timeframe").getVisible()) {
					oCalendar = this.getView().byId("cal_timeframe");
				} else {
					oCalendar = this.getView().byId("cal_interval");
				}
				//22.05.2019 Yannick END
			} else {
				oCalendar = sap.ui.getCore().byId(vId);
			}
			var aSelectedDates = oCalendar.getSelectedDates();
			if (aSelectedDates.length > 0 && aSelectedDates[0].getStartDate() !== null && aSelectedDates[0].getEndDate() !== null) {
				var oEndda1 = aSelectedDates[0].getEndDate();
				var oEndda = new Date(oEndda1);
				oEndda.setHours(12);
				return oEndda;
			}
		},

		setTableData: function (oTable, vUnitKey) {
			var oBegda = this.getSelectedBegda();
			var oEndda = this.getSelectedEndda();
			var oFilterDate = new sap.ui.model.Filter("PlanDate", sap.ui.model.FilterOperator.BT, oBegda, oEndda);
			var oFilterUnit = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

			this.getView().getModel().read("/planDataSet", {
				groupId: vUnitKey,
				filters: [oFilterDate, oFilterUnit],
				success: function (oData) {
					this.readPlanDataSuccess(oTable, vUnitKey, oData);
				}.bind(this),
				error: function (oEvent) {
					oTable.setBusy(false);
					this.handleException(oEvent);
					this.handleError(oEvent, oTable); //yannick
				}.bind(this),
				// refreshAfterChange: true
				refreshAfterChange: false
			});
		},

		//26.01.2021 KOBETC: function redesigned - optimized and prepared for not sorted data
		readPlanDataSuccess: function (oTable, vUnitKey, oData) {
			var that = this;
			var mViewData = {
				rows: []
			};

			var oModel = new sap.ui.model.json.JSONModel();
			var aData = oData.results;
			var aCBColumns = [];

			oTable.getColumns().forEach(function (item, index) {
				var oTemplate = item.getTemplate();
				if (oTemplate.getBindingInfo('selectedKey')) {
					var sPath = item.getTemplate().getBindingInfo('selectedKey').parts[0].path;
					sPath = sPath.substring(0, sPath.indexOf("/"));
					aCBColumns.push(sPath);
				}
			});

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

					if (aCBColumns.indexOf(item.FieldKey + vDate) !== -1) {
						that._oDataUtil.getItems(item.FieldKey, vUnitKey, {}).then(function (oResult) {
							var aItems = oResult.aItems;

							aItems.forEach(function (oItem) {
								if (oItem.ItemKey === item.FieldValue) {
									oRow[item.FieldKey + vDate].visiblevalue = oItem.ItemValue;
								}
							});
						});
					}

					if (item.FieldBColor) {
						that.libtables.addCssColoring(item.FieldBColor);
					}
				});

				Object.keys(oRows).forEach(function (item) {
					mViewData.rows.push(oRows[item]);
				});

				oModel.setData({
					modelData: mViewData
				});

				oTable.setModel(oModel);

				var iVRC = 1;
				if (oTable.getVisibleRowCount() === iVRC) {
					iVRC += 1;
				}
				oTable.setVisibleRowCount(iVRC);

				if (!oTable.getBusy()) oTable.setBusy(true);
				oTable.bindAggregation("rows", {
					path: "/modelData/rows"
				});

				var oEventAfterRender = {
					onAfterRendering: function (e) {
						that.unitTableFinalService(oTable);
						e.srcControl.removeEventDelegate(oEventAfterRender);
					}
				};
				oTable.addEventDelegate(oEventAfterRender);
			} else {
				oTable.setBusy(false);
			}

		},

		unitTableFinalService: function (oTable) {
			var oContent = oTable.getBinding("rows"),
				that = this;

			//KOBEC: somehow after searching employee rowheight of table is 0 with no interaction. fixing it in finalservice
			if (!oTable.getRowHeight()) this.getView().byId('sbtn_rowheight').fireSelectionChange();

			//TODO: replace by promises
			var repeatCount = 30;
			var setRowCount = function () {
				if (oTable.getModel().oData.modelData) {
					that.setRowCount(oTable, oTable.getModel().oData.modelData.rows);
					oTable.setCustomerRowCount(oTable.getVisibleRowCount());
					oTable.setVisibleRowCount(oContent.iLength);
					return;
				}
				setTimeout(function () {
					if (repeatCount < 0) return;
					if (!oTable.getModel().oData.modelData) {
						repeatCount--;
						setRowCount();
					} else {
						that.setRowCount(oTable, oTable.getModel().oData.modelData.rows);
						oTable.setCustomerRowCount(oTable.getVisibleRowCount());
						oTable.setVisibleRowCount(oTable.getBinding("rows").iLength);
					}
				}, 1000);
			};

			setRowCount();

			if (!this.isFeatureEnabled("EXPANDED")) {
				oTable.setBusy(true);
				setTimeout(function () {
					Helper.autoResize(oTable);
					setTimeout(oTable.setFixedColumnCount(oTable._fixedCC));
				}, 0);
				// oTable.setBusy(false);
			} else if (this.isFeatureEnabled("EXPANDED") && oTable.getVisible()) {
				oTable.setBusy(true);
				setTimeout(function () {
					Helper.autoResize(oTable);
					setTimeout(oTable.setFixedColumnCount(oTable._fixedCC));
				}, 0);
				// oTable.setBusy(false);
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
					press: this.showSumMsg.bind(this, oDate, vUnitKey)
				}).addStyleClass("btnText");

				oButton.addCustomData(new sap.ui.core.CustomData({
					key: "sumkey",
					// writeToDom: true,
					value: {
						path: vDate.toString() + "SumKey",
						formatter: Formatter.checkCustomDataIsString
					}
				}));

				var oTemplate = new sap.m.HBox({
					items: [oText, oButton]
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

		showSumMsg: function (oDate, vUnitKey, oEvent) {
			var oButton = oEvent.getSource();
			var aCustomData = oButton.getCustomData();
			var vKey = aCustomData[0].getProperty("key");
			var vSumKey;
			var oModel = this.getView().getModel();
			if (vKey == "sumkey") {
				vSumKey = aCustomData[0].getProperty("value");
			} else {
				vSumKey = aCustomData[1].getProperty("value");
			}

			var oSumMessagePopover = new sap.m.Popover({
				beforeClose: function () {
					this.oSumPopupOpen = false;
				}.bind(this),
				placement: "Auto"
			});

			var oCloseButton = new sap.m.Button({
				text: "X",
				tooltip: "{18n>close}",
				press: function () {
					if (sap.ui.getCore().byId("ld_select_attention")) {
						sap.ui.getCore().byId("ld_select_attention").destroy();
					}
					oSumMessagePopover.close();
				}
			});

			oSumMessagePopover.setBusyIndicatorDelay(0);
			oSumMessagePopover.setBusy(true);

			var oMessageList = new sap.m.List({
				headerText: "{i18n>messages}"
			});

			oSumMessagePopover.addContent(oMessageList);

			if (this.isFeatureEnabled('TAKEATTENT')) {
				var oMsgItem = new sap.m.ObjectListItem({
					icon: "sap-icon://error",
					title: "{MessageText}",
					type: "Active",
					intro: {
						path: "HasAttention",
						formatter: function (vAttention) {
							if (vAttention === "X") {
								var sIntro;
								sIntro = this.getResourceBundleText("tookAttention");
								return sIntro;
							}
						}.bind(this)
					},

					press: this.onMessageClick.bind(this)
				});
			} else {
				var oMsgItem = new sap.m.ObjectListItem({
					icon: "sap-icon://error",
					title: "{MessageText}",
					type: "Active",
					press: this.onHandleMessagePressAction.bind(this)
				});
			}

			if (this.oSumPopupOpen === true) {
				this.oMessagePopover.close();
				if (oEvent.getSource() == this.oMsgSumSource) {
					return;
				}
			}

			var oDateFilter = new sap.ui.model.Filter("PlanDate", sap.ui.model.FilterOperator.EQ, oDate);
			var oPlanBegda = this.getSelectedBegda();
			var oPlanEndda = this.getSelectedEndda();
			oPlanBegda.setUTCDate(oPlanBegda.getDate());
			oPlanEndda.setUTCDate(oPlanEndda.getDate());
			var oPlanBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, oPlanBegda);
			var oPlanEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, oPlanEndda);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oSumFilter = new sap.ui.model.Filter("SumKey", sap.ui.model.FilterOperator.EQ, vSumKey);

			this.oMessagePopover = oSumMessagePopover;
			oMessageList.setModel(oModel);
			oMessageList.bindAggregation("items", {
				template: oMsgItem,
				path: "/sumMessageSet",
				filters: [oDateFilter, oUnitFilter, oSumFilter, oPlanBegdaFilter, oPlanEnddaFilter],
				events: {
					dataReceived: function () {
						oSumMessagePopover.setBusy(false);
						oSumMessagePopover.setEndButton(oCloseButton);
					}
				}
			});

			this.oMsgSumSource = oEvent.getSource();

			this.oMessagePopover.openBy(oButton);
			this.oSumPopupOpen = true;

			if (sap.ui.getCore().byId("ld_select_attention")) {

				sap.ui.getCore().byId("ld_select_attention").destroy();
			}
		},

		onHandleMessagePressAction: function (oEvent) {
			var oModel = this.getView().getModel();
			if (oModel.getObject(oEvent.getSource().getBindingContext().getPath()).Action == "TimesOverview") {
				this.openTimeOverviewPopupWrapper(oEvent);
			} else {
				this.onMessageClick(oEvent);
			}
		},

		onMessageClick: function (oEvent) {
			var oModel = this.getView().getModel();
			if (this.isFeatureEnabled("TAKEATTENT")) {

				if (sap.ui.getCore().byId("ld_select_attention")) {
					sap.ui.getCore().byId("ld_select_attention").destroy();
				}

				if (sap.ui.getCore().byId("ta_attent_explain")) {
					sap.ui.getCore().byId("ta_attent_explain").destroy();
				}

				var oCtx = oEvent.getSource().getBindingContext();
				var oMsgObj = oModel.getObject(oCtx.getPath());

				var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
				var vAttentionChangeButtonText = oResourceBundle.getText("changeAttention");
				var vNoAttentionPossible = oResourceBundle.getText("noAttentionPossible");

				var vMessageType = oMsgObj.MessageType;

				var oPopover = new sap.m.Popover({
					title: "{i18n>attentionPopoverTitle}",
					beforeClose: function () {
						this.oPopoverOpen = false;
					},
					placement: "Auto"
				});
				this.getView().addDependent(oPopover);

				var oAttentionForm = new sap.ui.layout.form.SimpleForm({
					columnsXL: 12,
					columnsL: 12,
					columnsM: 12,
					layout: "ResponsiveGridLayout"
				});
				oPopover.addContent(oAttentionForm);

				var oTemplate = new sap.ui.core.Item({
					text: "{NoteText}",
					key: "{NoteKey}",
					customData: {
						key: "noteKey",
						value: "{NoteKey}"
					},
					layoutData: new sap.ui.layout.GridData({
						span: "XL12 L12 M12 S12"
					})
				});

				var oAttentionReasonSelect = new sap.m.Select({
					id: "ld_select_attention",
					selectedKey: "{SelAttention}"
				});

				var oExplanationTextArea = new sap.m.TextArea({
					id: "ta_attent_explain",
					layoutData: new sap.ui.layout.GridData({
						span: "XL12 L12 M12 S12"
					}),
					maxLength: 100,
					showExceededText: false,
					value: "{MsgExplanation}"
				});

				var oPlanDate = oMsgObj.PlanDate;
				var vUnitKey = oMsgObj.UnitKey;
				var vSumKey = oMsgObj.SumKey;
				var vNoteKey = oMsgObj.MsgParam;
				var vItemToSelect = oMsgObj.Action;
				var sEmpId = oMsgObj.EmpId;

				var oMsgTypeFilter = new sap.ui.model.Filter("MsgType", sap.ui.model.FilterOperator.EQ, vMessageType);
				var oDateFilter = new sap.ui.model.Filter("PlanDate", sap.ui.model.FilterOperator.EQ, oPlanDate);
				var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
				var oSumFilter = new sap.ui.model.Filter("SumKey", sap.ui.model.FilterOperator.EQ, vSumKey);

				var oMessageNote = {};
				oMessageNote.PlanDate = oPlanDate;
				oMessageNote.UnitKey = vUnitKey;
				oMessageNote.SumKey = vSumKey;
				oMessageNote.NoteKey = vNoteKey;
				oMessageNote.EmpId = sEmpId;

				var oAttentionButton = new sap.m.Button({
					text: "{i18n>takeAttention}",
					press: this.onAttentionButtonClick.bind(this, oMessageNote, oPopover, vUnitKey, oPlanDate),
					layoutData: new sap.ui.layout.GridData({
						span: "XL12 L12 M12 S12"
					})
				});
				oAttentionReasonSelect.setModel(oModel);
				oAttentionReasonSelect.bindItems({
					path: "/messageNoteSet",
					template: oTemplate,
					filters: [oMsgTypeFilter, oDateFilter, oUnitFilter, oSumFilter],
					events: {
						dataReceived: function (oData) {
							oPopover.setBusy(false);
						}.bind(this)
					}
				});

				if (oMsgObj.HasAttention !== "") {
					oAttentionButton.setText(vAttentionChangeButtonText);
				}

				var sPath = oModel.createKey("/messageNoteSet", {
					MsgType: vMessageType,
					SumKey: vSumKey,
					UnitKey: vUnitKey,
					NoteKey: vNoteKey,
					PlanDate: oPlanDate
				});
				oPopover.setModel(oModel);
				oPopover.bindElement({
					path: sPath,
					events: {
						dataReceived: function (oData) {
							oPopover.setBusy(false);
						}.bind(this)
					}
				});

				this.oMsgAttentionSource = oEvent.getSource();
				oPopover.openBy(oEvent.getSource());
				this.oPopoverOpen = true;

				if (oMsgObj.Attention === "X") {
					oAttentionForm.addContent(oAttentionReasonSelect);
					oAttentionForm.addContent(oAttentionButton);
					oAttentionForm.addContent(oExplanationTextArea);
				} else if (oMsgObj.SelAttention === "") {
					oPopover.setTitle(vNoAttentionPossible);
				}
			}
		},

		onAttentionButtonClick: function (oMessageNote, oPopover, vUnitKey, oPlanDate, oEvent) {
			var oModel = this.getView().getModel();
			this.oPopoverOpen = false;
			oMessageNote.NoteText = sap.ui.getCore().byId("ld_select_attention").getSelectedItem().getProperty("text");
			oMessageNote.SelAttention = sap.ui.getCore().byId("ld_select_attention").getSelectedKey();
			oMessageNote.MsgExplanation = sap.ui.getCore().byId("ta_attent_explain").getValue();

			oModel.create("/messageNoteSet", oMessageNote, {
				success: this.attentionButtonSuccess.bind(this, oPopover, oPlanDate, vUnitKey),
				error: this.createError.bind(this)
			});
		},

		onMsgCompletionButtonClick: function (oMsgCompletion, oPopover, vUnitKey) {
			var oModel = this.getView().getModel();
			this.oPopoverOpen = false;
			var oPlanDate;
			oMsgCompletion.SelAttention = sap.ui.getCore().byId("ld_select_attention").getSelectedKey();
			oMsgCompletion.MsgExplanation = sap.ui.getCore().byId("ta_attent_explain").getValue();
			oModel.create("/rptimeEmpLogSet", oMsgCompletion, {
				success: this.attentionButtonSuccess.bind(this, oPopover, oPlanDate, vUnitKey),
				error: this.createError.bind(this)
			});
		},

		attentionButtonSuccess: function (oPopover, vUnitKey, oPlanDate, oEvent) {
			sap.ui.getCore().byId("ld_select_attention").destroy();
			oPopover.close();
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vCreated = oResourceBundle.getText("attentionNoteCreated");
			MessageToast.show(vCreated);
		},

		setSelectedItem: function (oData, vSelectedItem) {
			sap.ui.getCore().byId("ld_select_attention").setSelectedKey(vSelectedItem);
		},

		fillSumData: function (oTable, vUnitKey) {
			if (this.getSelectedEndda() == null) {
				return;
			}
			var oModel = this.getView().getModel();
			var oBegda = this.getSelectedBegda();
			var oEndda = this.getSelectedEndda();
			oBegda.setUTCDate(oBegda.getDate());
			oEndda.setUTCDate(oEndda.getDate());

			var oTimeframeFilter = new sap.ui.model.Filter("PlanDate", sap.ui.model.FilterOperator.BT, oBegda, oEndda);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			oModel.read("/sumDataSet", {
				groupId: vUnitKey + "sds",
				filters: [oTimeframeFilter, oUnitFilter],
				success: function (oData) {
					this.sumDataSuccess(oTable, vUnitKey, oData);
				}.bind(this),
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

				if (aData[i].FieldBColor) {
					this.libtables.addCssColoring(aData[i].FieldBColor);
				}
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

			if (!oTable.getVisible()) {
				oTable.setVisible(true);
			}

			setTimeout(function () {
				Helper.autoResize(oTable);
			}, 500);

		},

		setRowCount: function (oTable, aRows) {
			var vLength = aRows.length;
			switch (this.isFeatureEnabled("ROWCOUNT")) {
			case true:
				if (vLength < this.oUserCust.Nooflines) {
					oTable.setVisibleRowCount(vLength);
				} else {
					oTable.setVisibleRowCount(this.oUserCust.Nooflines);
				}
				break;
			case false:
				if (vLength < this.oCustomizing.PlanVisRows) {
					oTable.setVisibleRowCount(vLength);
				} else {
					oTable.setVisibleRowCount(this.oCustomizing.PlanVisRows);
				}
				break;
			default:
				if (vLength < this.oCustomizing.PlanVisRows) {
					oTable.setVisibleRowCount(vLength);
				} else {
					oTable.setVisibleRowCount(this.oCustomizing.PlanVisRows);
				}
			}

		},

		handleMessagePopoverPress: function (oEvent) {
			if (!this.open) {
				oMessagePopover.openBy(oEvent.getSource());
			} else {
				oMessagePopover.close();
			}
			this.open = !this.open;
		},

		onSave: function () {
			var that = this;
			this.clearMessages();

			//TEST JQUERY START
			var aDeffered = [];

			for (var i = 0; i < this.aUnits.length; i++) {
				//test yannick hier achtung
				aDeffered.push(this.saveUnit(this.aUnits[i].UnitKey, i));
			}

			jQuery.when.apply(null, aDeffered).done(
				jQuery.proxy(this.onSaveSuccess, this)
			);

			//TEST JQUERY END

			// this.saveUnits();
			if (this.getView().getModel("CBData")) {
				var aData = this.getView().getModel("CBData").getData();
				var oData = {};
				var aPromises = [];
				for (var j = 0; j < aData.length; j++) {
					oData = aData[j];
					oData.PlanDate = new Date(oData.PlanDate);
					oData.PlanDate.setHours(12);
					aPromises.push(new Promise(function (resolve, reject) {
						that.getView().getModel().create("/dropdownDataSet", oData, {
							success: function (data) {
								resolve();
								// this.getView().getModel("CBData").setData([]);
								// var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
								// var vTxtDropdownSaved = oResourceBundle.getText("dropdownsaved");
								// MessageToast.show(vTxtDropdownSaved);
							}.bind(this),
							error: function (oError) {
								reject(oError);
								// this.getView().getModel("CBData").setData([]);
								// this.createError(oError);
							}.bind(this)
						});
					}));
				}

				var noError = true;
				Promise.all(aPromises).then(function () {
						// that.getView().getModel("CBData").setData([]);
						var oResourceBundle = that.getView().getModel("i18n").getResourceBundle();
						var vTxtDropdownSaved = oResourceBundle.getText("dropdownsaved");
						MessageToast.show(vTxtDropdownSaved);
					},
					function (oError) {
						noError = false;
						// that.getView().getModel("CBData").setData([]);
						that.createError(oError);
					}).then(function () {
					if (noError) {
						that.getView().getModel("CBData").setData([]);
						// var oResourceBundle = that.getView().getModel("i18n").getResourceBundle();
						// var vTxtDropdownSaved = oResourceBundle.getText("dropdownsaved");
						// MessageToast.show(vTxtDropdownSaved);
					}

					// function (oError) {
					// 	// that.getView().getModel("CBData").setData([]);
					// 	that.createError(oError);
					// })
					// }
				});
			}
		},

		saveUnit: function (vUnit) {
			var oModel = this.getView().getModel();
			var oModelDataDeferred = jQuery.Deferred();
			var oBegda = this.getSelectedBegda();
			var oEndda = this.getSelectedEndda();
			oBegda.setUTCDate(oBegda.getDate());
			oEndda.setUTCDate(oEndda.getDate());
			oModel.callFunction("/SavePlanningData", {
				method: "POST",
				urlParameters: {
					"UnitKey": vUnit,
					"Begda": oBegda,
					"Endda": oEndda
				},
				changeSetId: vUnit,
				success: function () {
					oModelDataDeferred.resolve();
					this.fillTablesForUnit(vUnit);
				}.bind(this),
				error: function (oError) {
					var aErrorMsg = JSON.parse(oError.responseText).error.innererror.errordetails;
					var vMessages = aErrorMsg.length;
					MessageBox.error(aErrorMsg[vMessages - 2].message);
				}.bind(this)
			});

			return oModelDataDeferred;

		},

		onSaveSuccess: function () {
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vTxtSaved = oResourceBundle.getText("assignsaved");
			MessageToast.show(vTxtSaved, {
				offset: "0 -133"
			});
		},

		onCancel: function () {
			Helper.openConfirmDialog("{i18n>unsaved}", "{i18n>areyousure}", "{i18n>yes}", this.cancelUnits.bind(this), function () {}, this);
		},

		cancelUnits: function () {
			this.clearMessages();
			for (var i = 0; i < this.aUnits.length; i++) {
				this.cancelUnit(this.aUnits[i].UnitKey);
			}
		},

		cancelUnit: function (vUnit) {
			var oModel = this.getView().getModel();
			var oBegda = this.getSelectedBegda();
			var oEndda = this.getSelectedEndda();
			oBegda.setUTCDate(oBegda.getDate());
			oEndda.setUTCDate(oEndda.getDate());

			oModel.callFunction("/CancelPlanningData", {
				method: "POST",
				urlParameters: {
					"UnitKey": vUnit,
					"Begda": oBegda,
					"Endda": oEndda
				},
				groupId: vUnit,
				changeSetId: vUnit,
				success: function (oData, response) {
					this.fillTablesForUnit(vUnit);
				}.bind(this),
				error: function (oError) {
					this.handleError(oError);
				}.bind(this)
			});
		},

		closeQualDialog: function () {
			this._qualDialog.close();
		},

		destroyEmpDataDialog: function () {

			var oSimpleForm = sap.ui.getCore().byId("sf_formEmployeeData");

			oSimpleForm.destroyContent();

			this._empDataDialog.destroy();
			this._empDataDialog = null;

		},

		onCloseEmpDataDialog: function () {
			this._empDataDialog.close();
		},

		fillTablesForUnit: function (vUnitKey) {
			var oPlanningTable = sap.ui.getCore().byId("tbl_plan_" + vUnitKey);
			var oPanel = sap.ui.getCore().byId("pnl" + vUnitKey);
			if (oPanel.getExpanded()) {
				if (oPlanningTable.getVisible()) {
					oPlanningTable.setBusy(true);
					this.removeColumns(oPlanningTable, "Dcol");
					if (oPlanningTable.getRows().length === 0) {
						oPlanningTable.destroyColumns();
						this.fillUnitTable(oPlanningTable, vUnitKey);
					} else {
						this.readDateUnit(oPlanningTable, vUnitKey);
					}
				}
				var oSumTable = sap.ui.getCore().byId("tbl_sum_" + vUnitKey);
				if (oSumTable.getVisible()) {
					oSumTable.setBusy(true);
					this.removeColumns(oSumTable, "Scol");
					this.fillSumTable(oSumTable, vUnitKey);
				}
			}
		},

		clearMessages: function () {
			var oModel = oMessagePopover.getModel();
			oModel.setData([]);
		},

		addMessage: function (vType, vText, vIdentifier) {
			var oMessage = {};
			oMessage.code = vIdentifier;
			oMessage.severity = vType;
			oMessage.message = vText;
			var aSuccessMsg = [];
			aSuccessMsg.push(oMessage);
			var oModel = oMessagePopover.getModel();
			var data = oModel.getData();
			data.push(oMessage);
			oModel.setData(data);
		},

		onShowHideSave: function (vUnitKey, oEvent) {
			var oModel = this.getView().getModel();
			var oVBox = sap.ui.getCore().byId("vb_hide_cols");
			var aItems = oVBox.getItems();
			var oObject = {};

			for (var i = 0; i < aItems.length; i++) {
				oObject = {};
				oObject = aItems[i].getBindingContext().getObject();
				oObject.IsActive = aItems[i].getSelected();
				oModel.create("/mycolSet", oObject);
			}

			if (this.isFeatureEnabled("VARIANTEMP")) {
				var oMCB = sap.ui.getCore().byId('idSelectEmployees'),
					oBind = oMCB.getBinding("items").getContexts();
				aItems = oMCB.getSelectedKeys();

				for (var i = 0; i < oBind.length; i++) {
					if (oBind[i].getProperty("IsVisible") && aItems.indexOf(oBind[i].getProperty("EmpId")) !== -1 || !oBind[i].getProperty(
							"IsVisible") && aItems.indexOf(oBind[i].getProperty("EmpId")) === -1) {
						continue;
					} else {
						var oData = oBind[i].getObject();
						oData.IsVisible = aItems.indexOf(oBind[i].getProperty("EmpId")) !== -1;
						this.getView().getModel().update(oBind[i].getPath(), oData);
					}
				}
			}

			var oSelVariant = sap.ui.getCore().byId("ld_select_variant");
			var vVariant = oSelVariant.getSelectedKey();
			var oObjectVar = {};
			// oObjectVar.Variant = parseInt(vVariant);
			// // oObjectVar.UnitKey = vUnitKey;
			// //oObjectVar.ForExcel = sap.ui.getCore().byId("cb_useForExcel").getSelected();
			// oModel.create("/colVariantSet", oObjectVar);

			this._oHideDialog.setBusy(true);
			this.closeHideShowColumns();
		},

		onSelectDropdownSave: function (vUnitKey, oEvent) {
			var oModel = this.getView().getModel();
			var oVBox = sap.ui.getCore().byId("vb_select_dropdown");
			var aItems = oVBox.getItems();
			var oObject = {};

			for (var i = 0; i < aItems.length; i++) {
				oObject = {};
				oObject = aItems[i].getBindingContext().getObject();
				oObject.Selected = aItems[i].getSelected();
				oModel.create("/selectDropdownSet", oObject);
			}

			this._oSelectDropdown.setBusy(true);
			this.onCloseSelectDropdown();
		},

		closeHideShowColumns: function () {
			var aPend = this.getView().getModel().getPendingChanges();
			var aKeys = Object.keys(aPend);
			var aReset = [];

			for (var i in aKeys) {
				if (aKeys[i].indexOf("mycolSet") !== -1) {
					aReset.push("/" + aKeys[i]);
				}
			}

			if (aReset.length > 0) {
				this.getView().getModel().resetChanges(aReset);
			}

			this._oHideDialog.close();
		},

		closeSelectDropdowns: function () {
			this._oSelectDropdown.close();
		},

		onChangeVariantForTable: function (vUnitKey, oEvent) {
			var oContext = oEvent.getSource().getSelectableItems()[oEvent.getSource().getSelectedIndex()].getBindingContext();
			var vVariant = oEvent.getParameter("selectedItem").getKey();
			var oModel = this.getView().getModel();
			var oObject = {};
			oObject = oContext.getObject();
			oObject.IsActive = true;
			oModel.update(oContext.sPath, oObject, {
				success: function (oData) {
					for (var i = 0; i < this.aUnits.length; i++) {
						this.onRefreshUnit(this.aUnits[i].UnitKey, this);
					}
				}.bind(this)
			});

		},

		loadVariantInSelect: function (vVariant) {
			var oSelect;
			for (var i = 0; i < this.aUnits.length; i++) {
				oSelect = sap.ui.getCore().byId("sel_var_" + this.aUnits[i].UnitKey);
				oSelect.setSelectedKey(vVariant);
			}
		},

		unassignEmployee: function (oEvent) {
			var oModel = this.getView().getModel();
			var vEmpID = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "EmpID");
			var vUnitKey = Helper.getCustomDataValue(oEvent.getSource().getAggregation("customData"), "UnitKey");
			var oBegda = this.getSelectedBegda();
			var oEndda = this.getSelectedEndda();
			oModel.callFunction("/UnassignEmployee", {
				method: "POST",
				urlParameters: {
					"EmpId": vEmpID,
					"UnitKey": vUnitKey,
					"Begda": oBegda,
					"Endda": oEndda
				},
				success: function () {
					this.refreshAllTables();
				}.bind(this),
				error: function (oError) {
					this.createError(oError);
				}.bind(this)
			});
		},

		prepareSAVEKAPA: function (vUnitKey) {
			var oModel = this.getView().getModel();
			var oSelectedBegda = this.getSelectedBegda();
			var oSelectedEndda = this.getSelectedEndda();
			var vPlanBegda = this.getFormattedDate(oSelectedBegda);
			var vPlanEndda = this.getFormattedDate(oSelectedEndda);
			var oRecord = {};

			oRecord.UnitKey = vUnitKey;
			oRecord.PlanBegda = vPlanBegda;
			oRecord.PlanEndda = vPlanEndda;

			oModel.create("/saveKapaSet", oRecord, {
				refreshAfterChange: true,

				success: this.saveKapaSuccess.bind(this),
				error: function () {
					this.createError.bind(this);
				}
			});
		},

		saveKapaSuccess: function () {
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vSuccess = oResourceBundle.getText("kapasuccess");
			MessageToast.show(vSuccess);
		},

		prepareDEMAND: function (vUnitKey) {
			if (!this._oMaintainDemandDialog) {
				this._oMaintainDemandDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.MaintainDemand", this, {
					refreshAfterChange: true
				});
				this._oMaintainDemandDialog.attachAfterClose(this.destroyMaintainDemandPopup.bind(this));
				this.getView().addDependent(this._oMaintainDemandDialog);

				this._oMaintainDemandDialog.setBusyIndicatorDelay(0);
				this._oMaintainDemandDialog.setBusy(true);
			}

			this._oMaintainDemandDialog.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));
			var oPlanBegda = this.getSelectedBegda();
			//			var oPlanEndda = this.getSelectedEndda();
			var oPlanEndda = new Date(9999, 11, 31);
			var oBegda = sap.ui.getCore().byId("dp_period_begda");
			var oEndda = sap.ui.getCore().byId("dp_period_endda");
			oBegda.setDateValue(oPlanBegda);
			oEndda.setDateValue(oPlanEndda);
			this.getQualItems(vUnitKey);
			this.bindDemandTable(vUnitKey);
			this._oMaintainDemandDialog.setBusy(false);
			this._oMaintainDemandDialog.open();
		},

		prepareDEMAND2: function (vUnitKey) {
			if (!this._oMaintainDemandDialog2) {
				this._oMaintainDemandDialog2 = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.MaintainDemandShiftGroup", this, {
					refreshAfterChange: true
				});
				this._oMaintainDemandDialog2.attachAfterClose(this.destroyMaintainDemandPopup2.bind(this));
				this.getView().addDependent(this._oMaintainDemandDialog2);

				this._oMaintainDemandDialog2.setBusyIndicatorDelay(0);
				this._oMaintainDemandDialog2.setBusy(true);
			}

			this._oMaintainDemandDialog2.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));

			var oModel = this.getView().getModel();
			var oPlanBegda = this.getSelectedBegda();
			var oPlanEndda = this.getSelectedEndda();
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oDataModel = new sap.ui.model.json.JSONModel();

			this._oMaintainDemandDialog2.setModel(oDataModel);
			this.getUnitShift(vUnitKey, oPlanBegda, oPlanEndda);

			oDataModel.setProperty("/unitKey", vUnitKey);

			oModel.read("/qualificationSet", {
				filters: [oUnitFilter],
				success: function (oData) {
					oDataModel.setProperty("/qualifications", oData.results);
				}.bind(this),
				error: this.handleError.bind(this)
			});
			this._oMaintainDemandDialog2.open();

		},

		prepareDEMAND3: function (vUnitKey) {
			if (!this._oMaintainDemandDialog3) {
				this._oMaintainDemandDialog3 = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.MaintainDemandShiftGroupForMan", this, {
					refreshAfterChange: true
				});
				this._oMaintainDemandDialog3.attachAfterClose(this.destroyMaintainDemandPopup3.bind(this));
				this.getView().addDependent(this._oMaintainDemandDialog3);

				this._oMaintainDemandDialog3.setBusyIndicatorDelay(0);
				this._oMaintainDemandDialog3.setBusy(true);
			}

			this._oMaintainDemandDialog3.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));

			var oModel = this.getView().getModel();
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oDataModel = new sap.ui.model.json.JSONModel();
			var oPlanBegda = this.getSelectedBegda();
			var oPlanEndda = this.getSelectedEndda();
			oDataModel.setProperty("/Begda", oPlanBegda);
			oDataModel.setProperty("/Endda", oPlanEndda);

			this._oMaintainDemandDialog3.setModel(oDataModel, "ManDemandModel");

			oDataModel.setProperty("/unitKey", vUnitKey);
			this.createTableForDemandShiftForMan(this._oMaintainDemandDialog3.getModel("ManDemandModel"), oPlanBegda, oPlanEndda);

			oModel.read("/qualificationSet", {
				filters: [oUnitFilter],
				success: function (oData) {
					oDataModel.setProperty("/qualifications", oData.results);
				}.bind(this),
				error: this.handleError.bind(this)
			});
			this._oMaintainDemandDialog3.open();
			this._oMaintainDemandDialog3.setBusy(false);
		},

		getShiftData: function () {
			var oModel = this._oMaintainDemandDialog3.getModel("ManDemandModel");
			var oPlanBegda = oModel.getProperty("/Begda");
			var oPlanEndda = oModel.getProperty("/Endda");

			this.createTableForDemandShiftForMan(oModel, oPlanBegda, oPlanEndda);
		},

		onDeleteDemandTimeWrapper: function () {
			Helper.openConfirmDialog("{i18n>areyousure}", "{i18n>warningdel}", "{i18n>delete}", this.onDeleteDemandTime.bind(this), function () {},
				this);
		},

		saveManShifts: function () {
			var oDemandTable = sap.ui.getCore().byId("tbl_demand_shiftgroupforman");
			var oModel = oDemandTable.getModel("ManDemandModel");
			var oDataModel = this.getView().getModel();
			var oForRemove = oModel.getProperty("/ForRemove");
			var that = this;
			var oDeferred = {};
			var aDeferred = [];

			var aDays = oDemandTable.getBinding('items').getContexts();

			for (var i in aDays) {
				var aDemands = aDays[i].getProperty("navdmandSet/results");
				for (var y in aDemands) {
					// var oEntry = oModel.getProperty("/unitShift");
					var oEntry = aDemands[y];

					var oCtx = {
						Id: oEntry.Id,
						// Shifts: parseInt(oEntry.Shifts),
						// UnitKey: oEntry.UnitKey,
						Begda: oEntry.Begda,
						Endda: oEntry.Endda,

						DemandImp1: oEntry.DemandImp1,
						DemandMan1: oEntry.DemandMan1,
						Group1: oEntry.Group1,

						DemandImp2: oEntry.DemandImp2,
						DemandMan2: oEntry.DemandMan2,
						Group2: oEntry.Group2,

						DemandImp3: oEntry.DemandImp3,
						DemandMan3: oEntry.DemandMan3,
						Group3: oEntry.Group3,

						DemandImp4: oEntry.DemandImp4,
						DemandMan4: oEntry.DemandMan4,
						Group4: oEntry.Group4
					};

					if (oCtx.Id === "9999999999") {
						oDeferred["ForCreate" + oCtx.Id] = $.Deferred();
						aDeferred.push(oDeferred["ForCreate" + oCtx.Id]);
						oDataModel.create("/unitShiftSet", oCtx, {
							refreshAfterChange: true,
							success: function (oData, oResponse) {
								oDeferred["ForCreate" + oCtx.Id].resolve();
							}.bind(this),
							error: function (oError) {
								oDeferred["ForCreate" + oCtx.Id].resolve();
								this.createError(oError);
							}.bind(this)
						});
					} else {
						oDeferred["ForUpdate" + oCtx.Id] = $.Deferred();
						aDeferred.push(oDeferred["ForUpdate" + oCtx.Id]);
						oDataModel.update("/dmand(\'" + oCtx.Id + "\')", oCtx, {
							success: function (oData, oResponse) {
								oDeferred["ForUpdate" + oCtx.Id].resolve();
							}.bind(this),
							error: function (oError) {
								oDeferred["ForUpdate" + oCtx.Id].resolve();
								this.createError(oError);
							}.bind(this)
						});
					}

					for (var i in oForRemove) {
						oDeferred["ForRemove" + oForRemove[i]] = $.Deferred();
						aDeferred.push(oDeferred["ForRemove" + oForRemove[i]]);
						oDataModel.remove("/dmand(\'" + oForRemove[i] + "\')", {
							refreshAfterChange: true,
							success: function () {
								oDeferred["ForRemove" + oForRemove[i]].resolve();
							}.bind(this),
							error: function (oError) {
								oDeferred["ForRemove" + oForRemove[i]].resolve();
								this.createError(oError);
							}.bind(this)
						});
					}
				}
			}

			$.when(aDeferred).done(function () {
				that._oMaintainDemandDialog3.setBusy(false);
				that.createTableForDemandShiftForMan(oModel, oModel.getProperty("/Begda"), oModel.getProperty("/Endda"));
			});
		},
		onDiscardManShifts: function () {
			var oModel = this._oMaintainDemandDialog3.getModel("ManDemandModel");

			this.createTableForDemandShiftForMan(oModel, oModel.getProperty("/Begda"), oModel.getProperty("/Endda"));
		},
		onManDemandShiftChange: function () {
			var oModel = this._oMaintainDemandDialog3.getModel("ManDemandModel");

			this.createTableForDemandShiftForMan(oModel, oModel.getProperty("/Begda"), oModel.getProperty("/Endda"));
		},
		createTableForDemandShiftForMan: function (oModel, Begda, Endda) {
			// var oModel = this.getView().getModel();
			var oDemandTable = sap.ui.getCore().byId("tbl_demand_shiftgroupforman");
			var oTemplate = sap.ui.getCore().byId("demandTableShiftGroupForManTemplate");
			// var oIdFilter = new sap.ui.model.Filter("Id", sap.ui.model.FilterOperator.EQ, vId);
			var oDateFilter = new sap.ui.model.Filter("Date", "BT", Begda, Endda);
			var aFilters = [];

			aFilters.push(oDateFilter);

			this.getView().getModel().read("/dmandDateSet", {
				urlParameters: {
					"$expand": "navdmandSet"
				},
				filters: aFilters,
				success: function (oData) {
					oModel.setProperty("/dmandDate", oData.results);
					oDemandTable.bindItems({
						path: "ManDemandModel>/dmandDate",
						template: oTemplate,
						templateShareable: true
					});
				}.bind(this),
				error: function (oError) {
					//implement suitable error handling here
				}
			});
		},
		onAddDemandQualForMan: function (oEvent) {
			var oDemandTable = sap.ui.getCore().byId("tbl_demand_shiftgroupforman");
			var aChilds = [];
			var sNavProperty = "navdmandSet";
			var oModel = oDemandTable.getModel("ManDemandModel");
			var oClickedLineContext = oEvent.getSource() /*.getParent()*/ .getParent().getBindingContext("ManDemandModel");

			if (typeof oEvent.getSource().getModel("ManDemandModel").getProperty(sNavProperty, oClickedLineContext) !== "undefined") {
				aChilds = oEvent.getSource().getModel("ManDemandModel").getProperty(sNavProperty, oClickedLineContext);
			}

			var oCtx = {
				Daynr: oEvent.getSource().getModel().getProperty("Date", oClickedLineContext),
				Id: "9999999999"
			};
			aChilds.results.push(oCtx);

			oEvent.getSource().getModel("ManDemandModel").setProperty(sNavProperty, aChilds, oClickedLineContext);
		},
		onDeleteDemandQualForMan: function (oEvent) {
			var oSrc = oEvent.getSource();
			var oBind = oSrc.getBindingContext("ManDemandModel");
			var oModel = oSrc.getModel("ManDemandModel");
			var aForRemove = oModel.getProperty("/ForRemove") || [];

			if (oBind.getProperty("Id") !== "9999999999") {
				aForRemove.push(oBind.getProperty("Id"));
			}

			var aItems = oModel.getProperty(oBind.getPath().substring(0, oBind.getPath().length - 2));
			aItems.forEach(function (item, i) {
				if (item.Id === oBind.getProperty("Id")) {
					aItems.splice(i, 1);
				}
			});

			oModel.setProperty(oBind.getPath().substring(0, oBind.getPath().length - 2), aItems);
		},

		getUnitShift: function (sUnitKey, oBegda, oEndda) {
			var oModel = this.getView().getModel();
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, sUnitKey);
			var oBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, oBegda);
			var oEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, oEndda);
			var oDataModel = this._oMaintainDemandDialog2.getModel();
			var oMaxDate = new Date("9999-12-31");
			var aFilter = [];
			aFilter.push(oUnitFilter);
			aFilter.push(oBegdaFilter);
			aFilter.push(oEnddaFilter);

			oModel.read("/unitShiftSet", {
				filters: aFilter,
				success: function (oData) {
					var vId;
					var oUnitShift = {};
					if (oData.results.length > 0) {
						oUnitShift = oData.results[0];
						vId = oData.results[0].Id;
					} else {
						oUnitShift = {
							Id: '9999999999',
							UnitKey: sUnitKey,
							Begda: oBegda,
							Endda: oMaxDate,
							Shifts: 1,
							Overwrite: false
						};
						vId = oUnitShift.Id;
						oData.results.push(oUnitShift);
					}
					this._oMaintainDemandDialog2.setBusy(false);
					oDataModel.setProperty("/unitShiftSet", oData.results);
					oDataModel.setProperty("/unitShift", oUnitShift);
					if (!oDataModel.getProperty("/Id")) oDataModel.setProperty("/Id", vId);
					this.createTableForDemandShift(vId, oDataModel);
				}.bind(this),
				error: function (oError) {
					this._oMaintainDemandDialog2.setBusy(false);
				}
			});
		},

		changeDemandShiftSelection: function (oEvent) {
			var oDataModel = this._oMaintainDemandDialog2.getModel();
			var oItem = oEvent.getParameter("selectedItem");
			var oUnitShift = oItem.getBindingContext().getObject();

			oDataModel.setProperty("/unitShift", oUnitShift);
			this.createTableForDemandShift(oUnitShift.Id, oDataModel);
		},

		createTableForDemandShift: function (vId, oModel) {
			// var oModel = this.getView().getModel();
			var oDemandTable = sap.ui.getCore().byId("tbl_demand_shiftgroup");
			var oTemplate = sap.ui.getCore().byId("demandTableShiftGroupTemplate");
			var oIdFilter = new sap.ui.model.Filter("Id", sap.ui.model.FilterOperator.EQ, vId);
			var aFilters = [];

			oDemandTable.setModel(oModel);
			aFilters.push(oIdFilter);
			this.getView().getModel().read("/demandDaySet", {
				urlParameters: {
					"$expand": "dayToDemand"
				},
				filters: aFilters,
				success: function (oData) {
					oModel.setProperty("/demandDaySet", oData.results);
					oDemandTable.bindItems({
						path: "/demandDaySet",
						template: oTemplate,
						templateShareable: true
					});
				}.bind(this),
				error: function (oError) {
					//implement suitable error handling here
				}
			});
		},

		onMoveDemandBack: function () {
			var oDemandTable = sap.ui.getCore().byId("tbl_demand_shiftgroup");
			var oModel = oDemandTable.getModel();
			var sId = oModel.getProperty("/unitShift/MoveBack");

			this.onMoveDemandTo(sId);
		},

		onMoveDemandFor: function () {
			var oDemandTable = sap.ui.getCore().byId("tbl_demand_shiftgroup");
			var oModel = oDemandTable.getModel();
			var sId = oModel.getProperty("/unitShift/MoveFor");

			this.onMoveDemandTo(sId);
		},

		onMoveDemandTo: function (sId) {
			var oDataModel = this.getView().getModel();
			var oDemandTable = sap.ui.getCore().byId("tbl_demand_shiftgroup");
			var oModel = oDemandTable.getModel();
			var sPath = oDataModel.createKey("/unitShiftSet", {
				Id: sId
			});

			oDataModel.read(sPath, { //0804
				success: function (oData) {
					var oUnitShift = oData;
					var vId = oData.Id;
					oModel.setProperty("/unitShift", oUnitShift);
					this.createTableForDemandShift(vId, oModel);
				}.bind(this),
				error: function (oError) {}
			});
		},

		onAddNewDemandTime: function () {
			var oDemandTable = sap.ui.getCore().byId("tbl_demand_shiftgroup");
			var oModel = oDemandTable.getModel();

			var oPlanBegda = this.getSelectedBegda();
			var oPlanEndda = this.getSelectedEndda();
			var oMaxDate = new Date('9999-12-31');

			var vUnitKey = oModel.getProperty("/unitShift/UnitKey");

			var oUnitShift = {
				Id: '9999999999',
				UnitKey: vUnitKey,
				Begda: oPlanBegda,
				Endda: oMaxDate,
				Shifts: 1,
				Overwrite: false
			};
			oModel.setProperty("/unitShift", oUnitShift);
			oModel.setProperty("/demandDaySet", []);
		},

		onDeleteDemandTime: function () {
			this._oMaintainDemandDialog2.setBusy(true);
			var oModel = this.getView().getModel();
			var oDemandTable = sap.ui.getCore().byId("tbl_demand_shiftgroup");
			var oViewModel = oDemandTable.getModel();
			var sId = oViewModel.getProperty("/unitShift/Id");
			var sUnitKey = oViewModel.getProperty("/unitShift/UnitKey");
			var sPath = oModel.createKey("/unitShiftSet", {
				Id: sId
			});
			var bNewData = false;
			var sNextId = oViewModel.getProperty("/unitShift/MoveBack");
			if (sNextId !== "0000000000") {
				bNewData = true;
			} else {
				sNextId = oViewModel.getProperty("/unitShift/MoveFor");
				if (sNextId !== "0000000000") {
					bNewData = true;
				}
			}

			oModel.remove(sPath, {
				success: function (oResponse) {
					var sSuccess = this.getResourceBundleText("demanddeleted");
					MessageToast.show(sSuccess);
					if (bNewData) {
						// this.onMoveDemandTo(sNextId);
						this.moveToLastDemand(sUnitKey);
						this._oMaintainDemandDialog2.setBusy(false);
					} else {
						this.onAddNewDemandTime();
						this._oMaintainDemandDialog2.setBusy(false);
					}
				}.bind(this),
				error: function (oError) {
					this._oMaintainDemandDialog2.setBusy(false);
					this.createError(oError);
				}.bind(this)
			});
		},

		onDemandShiftChange: function (oEvent) {
			var vShift = oEvent.getSource().getSelectedKey();
			// var oViewModel = this.getOwnerComponent().getModel("DemandView");
			var oModel = oEvent.getSource().getModel();
			oModel.setProperty("/unitShift/Shifts", vShift);
		},

		onAddDemandDay: function (oEvent) {
			var oDemandTable = sap.ui.getCore().byId("tbl_demand_shiftgroup");
			var oModel = oDemandTable.getModel();

			var aDemandDaySet = oModel.getProperty("/demandDaySet");
			var vCurrentDay = aDemandDaySet.length;

			var oCtxDay = {
				Daynr: (vCurrentDay + 1),
				Id: oModel.getProperty("/unitShift/Id") //0804Y
			};

			var oCtxQual = {
				Daynr: (vCurrentDay + 1),
				Id: oModel.getProperty("/unitShift/Id"), //0804Y
				// QualId: this.getOwnerComponent().getModel("DemandView").getProperty("/qualifications")[0].QualId //wasisthier?
				QualId: oModel.getProperty("/qualifications")[0].QualId
			};
			var aCtxQual = [];
			aCtxQual.push(oCtxQual);

			oCtxDay.dayToDemand = {};
			oCtxDay.dayToDemand.results = aCtxQual;
			aDemandDaySet.push(oCtxDay);
			oModel.setProperty("/demandDaySet", aDemandDaySet);
		},

		onAddDemandDayFromLast: function (oEvent) {
			var oDemandTable = sap.ui.getCore().byId("tbl_demand_shiftgroup");
			var oModel = oDemandTable.getModel();

			var aDemandDaySet = oModel.getProperty("/demandDaySet");
			var oCtxLastDay = aDemandDaySet[aDemandDaySet.length - 1];
			var oCtxDay = {
				Daynr: (aDemandDaySet.length + 1),
				Id: oModel.getProperty("/unitShift/Id"), //0804Y
				dayToDemand: {}
			};
			var aChildren = [];
			for (var i = 0; i < oCtxLastDay.dayToDemand.results.length; i++) {
				var oChild = {
					Daynr: oCtxDay.Daynr,
					Id: oModel.getProperty("/unitShift/Id"), //0804Y
					QualId: oCtxLastDay.dayToDemand.results[i].QualId,
					Demand1: oCtxLastDay.dayToDemand.results[i].Demand1,
					Demand2: oCtxLastDay.dayToDemand.results[i].Demand2,
					Demand3: oCtxLastDay.dayToDemand.results[i].Demand3,
					Demand4: oCtxLastDay.dayToDemand.results[i].Demand4,
					Demand5: oCtxLastDay.dayToDemand.results[i].Demand5,
					Demand6: oCtxLastDay.dayToDemand.results[i].Demand6
				};
				aChildren.push(oChild);
			}
			oCtxDay.dayToDemand.results = aChildren;
			aDemandDaySet.push(oCtxDay);
			oModel.setProperty("/demandDaySet", aDemandDaySet);
		},

		onAddDemandQual: function (oEvent) {
			var oDemandTable = sap.ui.getCore().byId("tbl_demand_shiftgroup");
			var aChilds = [];
			var sNavProperty = "dayToDemand";
			var oModel = oDemandTable.getModel();
			var oClickedLineContext = oEvent.getSource() /*.getParent()*/ .getParent().getBindingContext();

			if (typeof oEvent.getSource().getModel().getProperty(sNavProperty, oClickedLineContext) !== "undefined") {
				aChilds = oEvent.getSource().getModel().getProperty(sNavProperty, oClickedLineContext);
			}

			var oCtx = {
				Daynr: oEvent.getSource().getModel().getProperty("Daynr", oClickedLineContext),
				Id: oModel.getProperty("/unitShift/Id"), //0804Y
				// QualId: this.getOwnerComponent().getModel("DemandView").getProperty("/qualifications")[0].QualId
				QualId: oModel.getProperty("/qualifications")[0].QualId
			};
			aChilds.results.push(oCtx);

			oEvent.getSource().getModel().setProperty(sNavProperty, aChilds, oClickedLineContext);
		},

		onDeleteDemandQual: function (oEvent) {
			var oDemandTable = sap.ui.getCore().byId("tbl_demand_shiftgroup");
			var aChilds = [];
			var sNavProperty = "dayToDemand";
			var oClickedLineContext = oEvent.getSource().getParent().getParent().getBindingContext();

			if (typeof oEvent.getSource().getModel().getProperty(sNavProperty, oClickedLineContext) !== "undefined") {
				aChilds = oEvent.getSource().getModel().getProperty(sNavProperty, oClickedLineContext);
			}

			var oClickedItemContext = oEvent.getSource().getBindingContext();
			var vChildIndex = aChilds.results.findIndex(function (oObj) {
				if (oObj === oClickedItemContext.getObject()) {
					return true;
				} else {
					return false;
				}
			});
			aChilds.results.splice(vChildIndex, 1);

			//24.03.2020 Wenn der letzte Datensatz eines Tages gelöscht wurde, Tag entfernen und nachfolgende Tage nachrücken
			if (oEvent.getSource().getModel().getProperty(sNavProperty, oClickedLineContext).results.length === 0) {
				var aDays = oEvent.getSource().getModel().getProperty("/demandDaySet");
				var vDeletedDay = oEvent.getSource().getModel().getProperty("Daynr", oClickedLineContext);
				for (var i = vDeletedDay; i < aDays.length; i++) {
					aDays[i].Daynr = i;
					for (var j = 0; j < aDays[i].dayToDemand.results.length; j++) {
						aDays[i].dayToDemand.results[j].Daynr = i;
					}
				}
				aDays.splice(vDeletedDay - 1, 1);
				oEvent.getSource().getModel().setProperty("/demandDaySet", aDays);
			} else {
				oEvent.getSource().getModel().setProperty(sNavProperty, aChilds, oClickedLineContext);
			}
			// Ende, Code unten nochmal validieren

		},

		onSaveDemandShiftGroup: function (vId) {
			this._oMaintainDemandDialog2.setBusy(true);
			var oDemandTable = sap.ui.getCore().byId("tbl_demand_shiftgroup");
			var oModel = oDemandTable.getModel();
			var oDataModel = this.getView().getModel();
			var sNavProperty = "dayToDemand";
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var sSuccessMessage = oResourceBundle.getText("saved");

			var aRowBinding = oModel.getProperty("/demandDaySet");
			var aAddData = [];
			var aDelData = [];

			var oIdFilter = new sap.ui.model.Filter("Id", sap.ui.model.FilterOperator.EQ, vId);

			var aFilters = [];
			aFilters.push(oIdFilter);

			oDataModel.read("/demandDaySet", {
				urlParameters: {
					"$expand": "dayToDemand"
				},
				filters: aFilters,
				success: function (oData) {
					var vTableDays = aRowBinding.length;
					if (vTableDays !== 0) {
						//über TabellenTage rückwärts loopen
						while (vTableDays--) {
							//	über oDataTage loopen
							var vODataDays = oData.results.length;
							while (vODataDays--) {
								//		Wenn Tagesschlüssel gleich

								var oRowDay = aRowBinding[vTableDays];
								var oDataDay = oData.results[vODataDays];

								if (oRowDay.Daynr == oDataDay.Daynr && oRowDay.Id == oDataDay.Id) {
									var vTableQuals = oRowDay.dayToDemand.results.length;

									//			über Tabellenbindings rückwärts loopen
									while (vTableQuals--) {
										//				Über Odata rückwärts loopen
										var vODataQuals = oDataDay.dayToDemand.results.length;
										while (vODataQuals--) {
											//					Wenn in Odata gefunden mit dem Key -> aus odata löschen

											var oRowQual = oRowDay.dayToDemand.results[vTableQuals];
											var oDataQual = oDataDay.dayToDemand.results[vODataQuals];

											if (oRowQual.Daynr == oDataQual.Daynr && oRowQual.Id == oDataQual.Id && oRowQual.QualId == oDataQual.QualId) {
												oData.results[vODataDays].dayToDemand.results.splice(vODataQuals, 1);
											}
										}
									}
									//			über Odata loopen
									for (var i = 0; i < oData.results[vODataDays].dayToDemand.results.length; i++) {
										//				in Del Tabelle packen
										aDelData.push(oData.results[vODataDays].dayToDemand.results[i]);
									}
									//			oDataTag löschen
									oData.results.splice(vODataDays, 1);
								}

							}
							//	TabellenTag löschen
							for (var m = 0; m < aRowBinding[vTableDays].dayToDemand.results.length; m++) {
								aAddData.push(aRowBinding[vTableDays].dayToDemand.results[m]);
							}
							if (oData.results.length > 0) {
								aRowBinding.splice(vTableDays, 1);
							}
						}

						//Fall abfangen, dass ganze Tage gelöscht wurden
						for (var l = 0; l < oData.results.length; l++) {
							for (var n = 0; n < oData.results[l].dayToDemand.results.length; n++) {
								aDelData.push(oData.results[l].dayToDemand.results[n]);
							}
						}

						//hinzuzufügende Daten ins oDataModel schreiben
						for (var j = 0; j < aAddData.length; j++) {
							var oCtxQual = oDataModel.createEntry("/demandDayDemandSet", {
								properties: {
									Daynr: aAddData[j].Daynr, //Yannick Ruppert
									Id: vId,
									QualId: aAddData[j].QualId,
									Demand1: parseInt(aAddData[j].Demand1),
									Demand2: parseInt(aAddData[j].Demand2),
									Demand3: parseInt(aAddData[j].Demand3),
									Demand4: parseInt(aAddData[j].Demand4),
									Demand5: parseInt(aAddData[j].Demand5),
									Demand6: parseInt(aAddData[j].Demand6)
								}
							});
						}

						if (oDataModel.hasPendingChanges()) {
							oDataModel.submitChanges({
								success: function () {
									MessageToast.show(sSuccessMessage);
									this.createTableForDemandShift(vId, oModel);
									this._oMaintainDemandDialog2.setBusy(false);
								}.bind(this),
								error: function (oError) {
									this.createError(oError);
									this._oMaintainDemandDialog2.setBusy(false);
								}.bind(this)
							});
						}

						for (var k = 0; k < aDelData.length; k++) {
							var vPath = "/demandDayDemandSet(Daynr=" + aDelData[k].Daynr + ",Id='" + aDelData[k].Id +
								"',QualId='" + aDelData[k].QualId +
								"')";
							oDataModel.remove(vPath, {
								success: function (oResponse) {}.bind(this),
								error: function (oError) {
									this.createError(oError);
									this._oMaintainDemandDialog2.setBusy(false);
								}
							});
						}
					} else {
						this._oMaintainDemandDialog2.setBusy(false);
						MessageToast.show(sSuccessMessage);
					}
				}.bind(this),
				error: function (oError) {
					this._oMaintainDemandDsialog2.setBusy(false);
					//implement suitable error handling here
				}.bind(this)
			});

		},

		saveUnitShifts: function () {

			var oDemandTable = sap.ui.getCore().byId("tbl_demand_shiftgroup");
			var oModel = oDemandTable.getModel();
			var oDataModel = this.getView().getModel();

			var oEntry = oModel.getProperty("/unitShift");

			var oCtx = {
				Id: oEntry.Id,
				Overwrite: oEntry.Overwrite,
				Shifts: parseInt(oEntry.Shifts),
				UnitKey: oEntry.UnitKey,
				Begda: oEntry.Begda,
				Endda: oEntry.Endda,
				Beguz1: oEntry.Beguz1,
				Enduz1: oEntry.Enduz1,
				Beguz2: oEntry.Beguz2,
				Enduz2: oEntry.Enduz2,
				Beguz3: oEntry.Beguz3,
				Enduz3: oEntry.Enduz3,
				Beguz4: oEntry.Beguz4,
				Enduz4: oEntry.Enduz4,
				Beguz5: oEntry.Beguz5,
				Enduz5: oEntry.Enduz5,
				Beguz6: oEntry.Beguz6,
				Enduz6: oEntry.Enduz6
			};

			if (oCtx.Id === "9999999999") {
				oDataModel.create("/unitShiftSet", oCtx, {
					refreshAfterChange: true,
					success: function (oData, oResponse) {
						oModel.setProperty("/unitShift", oData);
						this.onSaveDemandShiftGroup(oData.Id);
					}.bind(this),
					error: function (oError) {
						this._oMaintainDemandDialog2.setBusy(false);
						this.createError(oError);
					}.bind(this)
				});
			} else {
				oDataModel.update("/unitShiftSet(\'" + oCtx.Id + "\')", oCtx, {
					refreshAfterChange: true,
					success: function (oData, oResponse) {
						this.onSaveDemandShiftGroup(oCtx.Id);
					}.bind(this),
					error: function (oError) {
						this._oMaintainDemandDialog2.setBusy(false);
						this.createError(oError);
					}.bind(this)
				});
			}

			this.moveToLastDemand(oEntry.UnitKey);
		},

		moveToLastDemand: function (sUnitKey) {
			var oDemandTable = sap.ui.getCore().byId("tbl_demand_shiftgroup");
			var oModel = oDemandTable.getModel();
			var oDataModel = this.getView().getModel();
			var oPlanBegda = this.getSelectedBegda();
			var oPlanEndda = this.getSelectedEndda();
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, sUnitKey);
			var oBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, oPlanBegda);
			var oEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, oPlanEndda);
			var aFilter = [];
			aFilter.push(oUnitFilter);
			aFilter.push(oBegdaFilter);
			aFilter.push(oEnddaFilter);

			oDataModel.read("/unitShiftSet", {
				filters: aFilter,
				success: function (oData) {
					oModel.setProperty("/unitShiftSet", oData.results);
					oModel.setProperty("/unitShift", oData.results[oData.results.length - 1]);
					oModel.setProperty("/Id", oData.results[oData.results.length - 1].Id);
					this.createTableForDemandShift(oData.results[oData.results.length - 1].Id, oModel);
				}.bind(this),
				error: function (oError) {
					this._oMaintainDemandDialog2.setBusy(false);
				}
			});
		},

		onCancelDemandShiftGroup: function () {
			this.getView().getModel().read("/demandDaySet", {
				urlParameters: {
					"$expand": "dayToDemand"
				},
				success: function (oData) {
					this._oMaintainDemandDialog2.getModel().setProperty("/demandDaySet", oData.results);
				}.bind(this)
			});
		},

		getQualItems: function (vUnitKey) {
			var oModel = this.getView().getModel();
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			if (this.oCustomizing.PlanHideQKey) {
				var oTemplate = new sap.ui.core.Item({
					text: "{QualText}",
					key: "{QualId}"
				});
			} else {
				var oTemplate = new sap.ui.core.Item({
					text: "{QualId} - {QualText}",
					key: "{QualId}"
				});
			}
			var oUnitSelect = sap.ui.getCore().byId("md_select_qual");
			oUnitSelect.setModel(oModel);
			oUnitSelect.bindAggregation("items", {
				path: "/qualificationSet",
				template: oTemplate,
				filters: [oUnitFilter]
			});
		},

		getAvailShiftSuccess: function (oData) {
			var oShiftSelect = sap.ui.getCore().byId("ld_select_shift");
			var oBeguz = sap.ui.getCore().byId("ld_tp_beguz_shift");
			var oEnduz = sap.ui.getCore().byId("ld_tp_enduz_shift");
			var oQualSelect = sap.ui.getCore().byId("md_select_qual");
			var oQualItem = oQualSelect.getFirstItem();
			var oSelectItem = oShiftSelect.getFirstItem();
			if (!oShiftSelect.getEnabled()) {
				oShiftSelect.setEnabled(true);
			}
			oQualSelect.setSelectedItem(oQualItem);
			oShiftSelect.setSelectedItem(oSelectItem);
			if (oSelectItem) {
				var oContext = oSelectItem.getBindingContext();
				var vBeguz = oShiftSelect.getModel().getProperty("Beguz", oContext);
				var vEnduz = oShiftSelect.getModel().getProperty("Enduz", oContext);
			}

			if (oBeguz.getEnabled()) {
				oBeguz.setEnabled(false);
			}
			oBeguz.setValue(vBeguz);
			if (oEnduz.getEnabled()) {
				oEnduz.setEnabled(false);
			}
			oEnduz.setValue(vEnduz);
		},

		onShiftChange: function (oEvent) {
			var oShiftItem = oEvent.getSource().getSelectedItem();
			var oShiftSelect = sap.ui.getCore().byId("ld_select_shift");
			var oBeguz = sap.ui.getCore().byId("ld_tp_beguz_shift");
			var oEnduz = sap.ui.getCore().byId("ld_tp_enduz_shift");

			var oSelectItem = oShiftSelect.getSelectedItem();
			var oContext = oSelectItem.getBindingContext();
			var vBeguz = oShiftSelect.getModel().getProperty("Beguz", oContext);
			var vEnduz = oShiftSelect.getModel().getProperty("Enduz", oContext);
			oBeguz.setValue(vBeguz);
			oEnduz.setValue(vEnduz);
		},

		onCloseMaintainDemand: function () {
			this._oMaintainDemandDialog.close();
		},
		onCloseMaintainDemand2: function () {
			this._oMaintainDemandDialog2.close();
		},
		onCloseMaintainDemand3: function () {
			this._oMaintainDemandDialog3.close();
		},

		destroyMaintainDemandPopup: function () {
			this._oMaintainDemandDialog.destroy();
			this._oMaintainDemandDialog = null;
		},
		destroyMaintainDemandPopup2: function () {
			this._oMaintainDemandDialog2.destroy();
			this._oMaintainDemandDialog2 = null;
		},
		destroyMaintainDemandPopup3: function () {
			this._oMaintainDemandDialog3.destroy();
			this._oMaintainDemandDialog3 = null;
		},

		getShiftItems: function (oEvent) {
			//MaintainDemand 
			var oModel = this.getView().getModel();
			var oDate = sap.ui.getCore().byId("dp_period_begda");
			var vDate = oDate.getDateValue();
			var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "yyyyMMdd"
			});
			var vDateFormatted = oDateFormat.format(vDate);
			var oDateFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, vDateFormatted);
			var vUnitKey = Helper.getCustomDataValue(this._oMaintainDemandDialog.getAggregation("customData"), "UnitKey");
			var oUnitFilterEQ = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oTemplate = new sap.ui.core.Item({
				text: "{ShiftName}",
				key: "{ShiftKey}"
			});
			var oShiftSelect = sap.ui.getCore().byId("ld_select_shift");

			oShiftSelect.setModel(oModel);
			oShiftSelect.bindAggregation("items", {
				path: "/availEmpShiftSet",
				template: oTemplate,
				events: {
					dataReceived: this.getAvailShiftSuccess.bind(this)
				},
				filters: [oDateFilter, oUnitFilterEQ]
			});
		},

		onSelectOwnShiftTime: function (oEvent) { //DEMAND
			var vSelected = oEvent.getSource().getSelected();
			var oShiftSelect = sap.ui.getCore().byId("ld_select_shift");
			var oBeguz = sap.ui.getCore().byId("ld_tp_beguz_shift");
			var oEnduz = sap.ui.getCore().byId("ld_tp_enduz_shift");

			switch (vSelected) {
			case true:
				oShiftSelect.removeAllItems();
				oShiftSelect.setEnabled(false);

				if (!oBeguz.getEnabled()) {
					oBeguz.setEnabled(true);
				}

				if (!oEnduz.getEnabled()) {
					oEnduz.setEnabled(true);
				}
				break;
			case false:
				this.getShiftItems();
			default:
				return;
			}

		},

		bindDemandTable: function () {
			var oBegda = sap.ui.getCore().byId("dp_period_begda");
			var oEndda = sap.ui.getCore().byId("dp_period_endda");
			var oModel = this.getView().getModel();
			if (oBegda && oEndda && (oBegda.getDateValue() <= oEndda.getDateValue())) {
				var vUnitKey = Helper.getCustomDataValue(this._oMaintainDemandDialog.getAggregation("customData"), "UnitKey");
				var oDemandTable = sap.ui.getCore().byId("tbl_md_demands");
				var oUnitFilterEQ = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
				var vPlanBegda = this.getFormattedDate(oBegda.getDateValue());
				var vPlanEndda = this.getFormattedDate(oEndda.getDateValue());
				var oPlanBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, vPlanBegda);
				var oPlanEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, vPlanEndda);
				oDemandTable.setBusy(true);
				oDemandTable.setModel(oModel);
				oDemandTable.bindAggregation("rows", {
					path: "/demandSet",
					filters: [oUnitFilterEQ, oPlanBegdaFilter, oPlanEnddaFilter],
					events: {
						dataReceived: function (oData) {
							this.getDemandTableDataSuccess(oData);
						}.bind(this)
					}
				});
				setTimeout(function () {
					Helper.autoResize(oDemandTable);
				}, 500);
			}

		},

		getDemandTableDataSuccess: function (oData) {
			var oTable = sap.ui.getCore().byId("tbl_md_demands");
			oTable.setSelectedIndex(-1);
			oTable.setBusy(false);
		},

		onDemandTableSelectionChange: function (oEvent) {
			var oTable;
			if (oEvent === sap.ui.getCore().byId("tbl_md_demands")) {
				oTable = oEvent;
			} else {
				var oTable = oEvent.getSource();
			}
			this.handleTableSelectionChange(oTable);
		},

		onChangeDemandBegda: function () {
			this.bindDemandTable();
		},

		onChangeDemandEndda: function () {
			this.bindDemandTable();
		},

		onSaveNewDemand: function (oEvent) {
			var oModel = this.getView().getModel();
			var oObject = {};
			var oQualSelect = sap.ui.getCore().byId("md_select_qual");
			var oBegda = sap.ui.getCore().byId("dp_period_begda");
			var oEndda = sap.ui.getCore().byId("dp_period_endda");
			var vUnitKey = Helper.getCustomDataValue(this._oMaintainDemandDialog.getAggregation("customData"), "UnitKey");
			var vBegda = oBegda.getDateValue();
			var vEndda = oEndda.getDateValue();
			var vFormattedBegda = this.getFormattedDate(oBegda.getDateValue());
			var vFormattedEndda = this.getFormattedDate(oEndda.getDateValue());
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var oTable = sap.ui.getCore().byId("tbl_md_demands");
			oBegda.setValueState(sap.ui.core.ValueState.None);
			oEndda.setValueState(sap.ui.core.ValueState.None);
			if (vBegda && vEndda && vEndda >= vBegda) {
				oTable.setBusy(true);
				oObject.UnitKey = vUnitKey;
				oObject.Begda = vFormattedBegda;
				oObject.Endda = vFormattedEndda;
				oObject.QualKey = oQualSelect.getSelectedItem().getKey();
				oObject.Beguz = sap.ui.getCore().byId("ld_tp_beguz_shift").getValue();
				oObject.Enduz = sap.ui.getCore().byId("ld_tp_enduz_shift").getValue();
				oObject.Override = sap.ui.getCore().byId("chb_overload").getSelected();
				oObject.WithoutDisposition = sap.ui.getCore().byId("chb_qualification").getSelected();
				oObject.Monday = sap.ui.getCore().byId("md_i_mo").getValue();
				oObject.Tuesday = sap.ui.getCore().byId("md_i_tu").getValue();
				oObject.Wednesday = sap.ui.getCore().byId("md_i_we").getValue();
				oObject.Thursday = sap.ui.getCore().byId("md_i_th").getValue();
				oObject.Friday = sap.ui.getCore().byId("md_i_fr").getValue();
				oObject.Saturday = sap.ui.getCore().byId("md_i_sa").getValue();
				oObject.Sunday = sap.ui.getCore().byId("md_i_su").getValue();
				oObject.Holiday = sap.ui.getCore().byId("md_i_ho").getValue();
				oObject.QualText = oQualSelect.getSelectedItem().getText().slice(0, 20);

				oModel.create("/demandSet", oObject, {
					refreshAfterChange: true,
					success: function (oData, oResponse) {

						var vSuccessMessage = oResourceBundle.getText("demandcreated", [oObject.Beguz, oObject.Enduz, oObject.QualText]);
						this.bindDemandTable();
						MessageToast.show(vSuccessMessage);
					}.bind(this),
					error: this.createError.bind(this)
				});
				this.clearDemandDialogValues();
			} else {
				if (!vBegda) {
					oBegda.setValueState(sap.ui.core.ValueState.Error);
				}
				if (!vEndda) {
					oEndda.setValueState(sap.ui.core.ValueState.Error);
				}
				if (vBegda > vEndda) {
					oBegda.setValueState(sap.ui.core.ValueState.Error);
				}
			}

		},

		clearDemandDialogValues: function () {
			var oTable = sap.ui.getCore().byId("tbl_md_demands");
			if (oTable.getSelectedIndex() !== -1) {
				oTable.setSelectedIndex(-1);
			}
			sap.ui.getCore().byId("chb_overload").setSelected(false);
			sap.ui.getCore().byId("chb_qualification").setSelected(false);
			sap.ui.getCore().byId("md_i_mo").setValue("");
			sap.ui.getCore().byId("md_i_tu").setValue("");
			sap.ui.getCore().byId("md_i_we").setValue("");
			sap.ui.getCore().byId("md_i_th").setValue("");
			sap.ui.getCore().byId("md_i_fr").setValue("");
			sap.ui.getCore().byId("md_i_sa").setValue("");
			sap.ui.getCore().byId("md_i_su").setValue("");
			sap.ui.getCore().byId("md_i_ho").setValue("");
		},

		handleTableSelectionChange: function (oTable) {
			var oQualSelect = sap.ui.getCore().byId("md_select_qual");
			var oBegda = sap.ui.getCore().byId("dp_period_begda");
			var oEndda = sap.ui.getCore().byId("dp_period_endda");
			var oBeguz = sap.ui.getCore().byId("ld_tp_beguz_shift");
			var oEnduz = sap.ui.getCore().byId("ld_tp_enduz_shift");
			var oOverload = sap.ui.getCore().byId("chb_overload");
			var oQualification = sap.ui.getCore().byId("chb_qualification");
			var oMo = sap.ui.getCore().byId("md_i_mo");
			var oTu = sap.ui.getCore().byId("md_i_tu");
			var oWe = sap.ui.getCore().byId("md_i_we");
			var oTh = sap.ui.getCore().byId("md_i_th");
			var oFr = sap.ui.getCore().byId("md_i_fr");
			var oSa = sap.ui.getCore().byId("md_i_sa");
			var oSu = sap.ui.getCore().byId("md_i_su");
			var oHo = sap.ui.getCore().byId("md_i_ho");

			if (oTable.getSelectedIndex() == -1) {
				sap.ui.getCore().byId("btn_md_delete").setEnabled(false);
				sap.ui.getCore().byId("btn_md_change").setEnabled(false);
				sap.ui.getCore().byId("btn_md_copy").setEnabled(false);
				sap.ui.getCore().byId("btn_md_save").setEnabled(true);
				sap.ui.getCore().byId("dp_period_begda").setEnabled(true);
				sap.ui.getCore().byId("dp_period_endda").setEnabled(true);
				var oMaxDate = new Date(9999, 11, 31);
				oEndda.setDateValue(oMaxDate);
				this.clearDemandDialogValues();
			} else {
				sap.ui.getCore().byId("dp_period_begda").setEnabled(false);
				sap.ui.getCore().byId("dp_period_endda").setEnabled(false);
				sap.ui.getCore().byId("btn_md_delete").setEnabled(true);
				sap.ui.getCore().byId("btn_md_change").setEnabled(true);
				sap.ui.getCore().byId("btn_md_copy").setEnabled(true);
				sap.ui.getCore().byId("btn_md_save").setEnabled(false);
				var oContext = oTable.getContextByIndex(oTable.getSelectedIndex());
				var oTableItem = oContext.getObject();
				oQualSelect.setSelectedKey(oTableItem.QualKey);
				oBegda.setValue(oTableItem.Begda);
				oEndda.setValue(oTableItem.Endda);
				oBeguz.setEnabled(true);
				oEnduz.setEnabled(true);
				oBeguz.setValue(oTableItem.Beguz);
				oEnduz.setValue(oTableItem.Enduz);
				oOverload.setSelected(oTableItem.Override);
				oQualification.setSelected(oTableItem.WithoutDisposition);
				oMo.setValue(oTableItem.Monday);
				oTu.setValue(oTableItem.Tuesday);
				oWe.setValue(oTableItem.Wednesday);
				oTh.setValue(oTableItem.Thursday);
				oFr.setValue(oTableItem.Friday);
				oSa.setValue(oTableItem.Saturday);
				oSu.setValue(oTableItem.Sunday);
				oHo.setValue(oTableItem.Holiday);
			}
		},

		onDeleteDemand: function () {
			var oModel = this.getView().getModel();
			var oTable = sap.ui.getCore().byId("tbl_md_demands");
			var oContext = oTable.getContextByIndex(oTable.getSelectedIndex());
			var oObject = oContext.getObject();
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			oTable.setBusy(true);
			oModel.remove(oContext.sPath, {
				refreshAfterChange: true,
				success: function (oResponse) {
					var vDemandDeleted = oResourceBundle.getText("demanddeleted", [oObject.Beguz, oObject.Enduz, oObject.QualText]);
					this.bindDemandTable();
					this.handleTableSelectionChange(oTable);
					oTable.setBusy(false);
					MessageToast.show(vDemandDeleted);
				}.bind(this),
				error: function (oError) {
					oTable.setBusy(false);
					this.createError.bind(this);
				}
			});
		},

		onCancelDemandEditing: function () {
			this.clearDemandDialogValues();
		},

		onCopyDemandEntry: function (oEvent) {
			this.onSaveNewDemand();
		},

		onChangeDemandEntry: function (oEvent) {
			var oModel = this.getView().getModel();
			var oRecord = {};
			var oQualSelect = sap.ui.getCore().byId("md_select_qual");
			var oBegda = sap.ui.getCore().byId("dp_period_begda");
			var oEndda = sap.ui.getCore().byId("dp_period_endda");
			var vUnitKey = Helper.getCustomDataValue(this._oMaintainDemandDialog.getAggregation("customData"), "UnitKey");
			var vBegda = oBegda.getDateValue();
			var vEndda = oEndda.getDateValue();
			var vFormattedBegda = this.getFormattedDate(oBegda.getDateValue());
			var vFormattedEndda = this.getFormattedDate(oEndda.getDateValue());
			var oTable = sap.ui.getCore().byId("tbl_md_demands");
			var oContext = oTable.getContextByIndex(oTable.getSelectedIndex());
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

			oBegda.setValueState(sap.ui.core.ValueState.None);
			oEndda.setValueState(sap.ui.core.ValueState.None);

			if (vBegda && vEndda && vEndda >= vBegda) {
				oRecord.UnitKey = vUnitKey;
				oRecord.Begda = vFormattedBegda;
				oRecord.Endda = vFormattedEndda;
				oRecord.QualKey = oQualSelect.getSelectedItem().getKey();

				oRecord.Beguz = sap.ui.getCore().byId("ld_tp_beguz_shift").getValue();
				oRecord.Enduz = sap.ui.getCore().byId("ld_tp_enduz_shift").getValue();
				oRecord.Override = sap.ui.getCore().byId("chb_overload").getSelected();
				oRecord.WithoutDisposition = sap.ui.getCore().byId("chb_qualification").getSelected();
				oRecord.Monday = sap.ui.getCore().byId("md_i_mo").getValue();
				oRecord.Tuesday = sap.ui.getCore().byId("md_i_tu").getValue();
				oRecord.Wednesday = sap.ui.getCore().byId("md_i_we").getValue();
				oRecord.Thursday = sap.ui.getCore().byId("md_i_th").getValue();
				oRecord.Friday = sap.ui.getCore().byId("md_i_fr").getValue();
				oRecord.Saturday = sap.ui.getCore().byId("md_i_sa").getValue();
				oRecord.Sunday = sap.ui.getCore().byId("md_i_su").getValue();
				oRecord.Holiday = sap.ui.getCore().byId("md_i_ho").getValue();
				oRecord.QualText = oQualSelect.getSelectedItem().getText().slice(0, 20);

				oModel.update(oContext.sPath, oRecord, {
					refreshAfterChange: true,
					success: function () {
						var vSuccessMessage = oResourceBundle.getText("demandchanged", [oRecord.Beguz, oRecord.Enduz, oRecord.QualText]);
						MessageToast.show(vSuccessMessage);
						this.bindDemandTable();
					}.bind(this),
					error: this.createError.bind(this)
				});

				this.clearDemandDialogValues();

			} else {
				if (!vBegda) {
					oBegda.setValueState(sap.ui.core.ValueState.Error);
				}
				if (!vEndda) {
					oEndda.setValueState(sap.ui.core.ValueState.Error);
				}
				if (vBegda > vEndda) {
					oBegda.setValueState(sap.ui.core.ValueState.Error);
				}
			}
		},

		openCommentPopupWrapper: function (oEvent) {
			if (this.isFeatureEnabled("ADDINFO")) {
				this.openCommentPopUp(true, oEvent);
			} else {
				this.openCommentPopUp(false, oEvent);
			}
		},

		openCommentPopUp: function (bShowAdditionalInfo, oEvent) {
			// if (oEvent.getId().match("^Dcol_")) {

			if (!this._oCommentDialog) {
				this._oCommentDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.Comments", this, {
					refreshAfterChange: true
				});
				this.getView().addDependent(this._oCommentDialog);
				var oCommentModel = this.getOwnerComponent().getModel("Comments");
				oCommentModel.setDefaultBindingMode(sap.ui.model.BindingMode.OneWay);
				this._oCommentDialog.setModel(oCommentModel);
				this._oCommentDialog.open();
				this._oCommentDialog.attachAfterClose(this.destroyCommentDialog.bind(this));
				var oAddInfo = sap.ui.getCore().byId("ta_additionalInfo");
				oAddInfo.setVisible(bShowAdditionalInfo);
				sap.ui.getCore().byId("lbl_additionalInfo").setVisible(bShowAdditionalInfo);
			}
			var aCustomData = oEvent.getCustomData();
			var vDate = Helper.getCustomDataValue(aCustomData, "PlanDate");
			vDate = typeof (vDate) === "string" ? parseInt(vDate) : vDate;
			var oDate = new Date(vDate);
			var vTitle = this.getResourceBundleText("commentfordate");
			var oModel = this.getView().getModel();
			this._oCommentDialog.setTitle(vTitle + " " + oDate.toLocaleDateString("de-DE"));

			var vUnitKey = Helper.getCustomDataValue(aCustomData, "UnitKey");

			this._oCommentDialog.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));

			this._oCommentDialog.addCustomData(new sap.ui.core.CustomData({
				key: "Date",
				// writeToDom: true,
				value: vDate
			}));
			var oTextArea = sap.ui.getCore().byId("ta_com_newCom");
			var sPath = this.getCommentPath(vDate, vUnitKey);
			if (sPath) {
				oTextArea.bindElement(sPath);
			} else {
				var aComments = oCommentModel.getProperty("/results");
				var oNewComment = {
					UnitKey: vUnitKey,
					PlanDate: oDate,
					CommentDate: ""
				};
				aComments.push(oNewComment);
				oCommentModel.setProperty("/results", aComments);
				sPath = this.getCommentPath(vDate, vUnitKey);
				oTextArea.bindElement(sPath);
			}
			if (bShowAdditionalInfo) {
				sPath = oModel.createKey("/additionalInformationSet", {
					UnitKey: vUnitKey,
					Date: oDate
				});

				oAddInfo.setModel(oModel);

				oModel.read(sPath, {
					success: function (oData) {
						sap.ui.getCore().byId("ta_additionalInfo").setValue(oData.Text);
					}.bind(this)
				});
			}
			// }
		},

		onCommentDialogClose: function () {
			this._oCommentDialog.close();
			this.destroyCommentDialog();
		},

		destroyCommentDialog: function () {
			var oTextArea = sap.ui.getCore().byId("ta_com_newCom");
			var oContext = oTextArea.getBindingContext();
			var sCommentText = oContext.getProperty("CommentDate");
			if (!sCommentText) {
				oContext.getModel().getData().results.splice(oContext.getPath().substr(9), 1);
			}
			this._oCommentDialog.destroy();
			this._oCommentDialog = null;
		},

		getCommentPath: function (vDate, vUnitKey) {
			var oCommentModel = this.getOwnerComponent().getModel("Comments");
			var oDate = new Date(vDate);
			var sPath;

			$.each(oCommentModel.getData().results, function (id, data) {
				if (data.PlanDate.toString() === oDate.toString() && data.UnitKey === vUnitKey) {
					sPath = "/results/" + id;
				}
			});
			return sPath;
		},

		checkHasComment: function (vDate, vUnitKey) {
			var oCommentModel = this.getOwnerComponent().getModel("Comments");
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

		onSaveComment: function (oEvent) {
			var oModel = this.getView().getModel();
			var oTextArea = sap.ui.getCore().byId("ta_com_newCom");
			var vComment = oTextArea.getValue();
			var vUnitKey = Helper.getCustomDataValue(this._oCommentDialog.getAggregation("customData"), "UnitKey");
			var vDate = Helper.getCustomDataValue(this._oCommentDialog.getAggregation("customData"), "Date");
			var oDate = new Date(vDate);
			// vDate = new Date(vDate);
			oTextArea.setValueState(sap.ui.core.ValueState.None);
			if (vComment) {
				var oRecord = {};
				oRecord.UnitKey = vUnitKey;
				oRecord.PlanDate = oDate;
				//@TODO: Patrick. Hier richtig binden
				// oRecord.CommentDate = oTextArea.getBindingContext().getProperty("CommentDate");
				oRecord.CommentDate = vComment;

				oModel.create("/commentSet", oRecord, {
					refreshAfterChange: true,
					success: function (oData) {
						var oContext = sap.ui.getCore().byId("ta_com_newCom").getBindingContext();
						var oCommentModel = oContext.getModel();
						oData.PlanDate.setHours(12);
						var oNewComment = {
							UnitKey: oData.UnitKey,
							PlanDate: oData.PlanDate,
							CommentDate: oData.CommentDate
						};
						oCommentModel.setProperty(oContext.getPath(), oNewComment, oContext);
						MessageToast.show(this.getResourceBundleText("commentsaved"));
						this._oCommentDialog.close();
					}.bind(this),
					error: function (oError) {
						this.createError(oError);
					}.bind(this)
				});
			} else {
				oTextArea.setValueState(sap.ui.core.ValueState.Error);
			}
		},

		onDeleteComment: function () {
			Helper.openConfirmDialog("{i18n>deletecomment}", "{i18n>areyousure}", "{i18n>btndeletecommenttxt}", this.deleteComment.bind(
					this),
				null, this);
		},

		deleteComment: function (oController) {
			var vUnitKey = Helper.getCustomDataValue(oController._oCommentDialog.getAggregation("customData"), "UnitKey");
			var vDate = Helper.getCustomDataValue(oController._oCommentDialog.getAggregation("customData"), "Date");
			var sPath = oController.getView().getModel().createKey("/commentSet", {
				UnitKey: vUnitKey,
				PlanDate: vDate
			});

			oController.getView().getModel().remove(sPath, {
				refreshAfterChange: true,
				success: function () {
					MessageToast.show(oController.getResourceBundleText("commentdeleted"));
					oController._oCommentDialog.close();
					oController.getView().getModel().read(sPath, {
						success: function () {
							var oTextArea = sap.ui.getCore().byId("ta_com_newCom");
							var oContext = oTextArea.getBindingContext();
							oContext.getModel().getData().results.splice(oContext.getPath().substr(9), 1);
						}
					});
				}.bind(oController),
				error: function (oError) {
					oController.createError(oError);
				}.bind(oController)
			});
		},

		handleLiveChange: function (oEvent) {
			var oTextArea = oEvent.getSource();
			var iValueLength = oTextArea.getValue().length;
			var iMaxLength = oTextArea.getMaxLength();
			var sState = iValueLength > iMaxLength ? "Warning" : "None";

			oTextArea.setValueState(sState);
		},

		getTimeTransfer: function () {
			var oModel = this.getView().getModel();
			var oTable = sap.ui.getCore().byId("ld_tbl_timetransferoverview");

			var oDate = sap.ui.getCore().byId("ld_dp_date");
			var vDateValue = oDate.getDateValue();
			if (vDateValue !== null) {
				vDateValue.setHours(12);
			}
			var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "yyyyMMdd"
			});
			var vDateFormatted = oDateFormat.format(vDateValue);
			var oDateFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, vDateFormatted);

			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oSelectedItem = oEmpSelect.getSelectedItem();
			var vEmpId = oSelectedItem.getKey();
			var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);

			var aCustomData = oSelectedItem.getCustomData();
			var vUnitKey = Helper.getCustomDataValue(aCustomData, "UnitKey");
			var oUnitKeyFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

			var oDateToday = new Date();

			var oDpBegda = sap.ui.getCore().byId("ld_dp_begda_timetransfer");

			var oDpEndda = sap.ui.getCore().byId("ld_dp_endda_timetransfer");
			oDpBegda.setDateValue(oDateToday);
			oDpEndda.setDateValue(oDateToday);

			oTable.setModel(oModel);
			oTable.setBusyIndicatorDelay(0);
			oTable.setBusy(true);
			oTable.bindRows({
				path: "/timeTransferSet",
				filters: [oEmpIdFilter, oDateFilter, oUnitKeyFilter],
				events: {
					dataReceived: function () {
						oTable.setBusy(false);
					}.bind(this)
				}
			});

			var oSelectSubty = sap.ui.getCore().byId("ld_select_subty_timetransfer");

			var oTemplateShifts = new sap.ui.core.Item({
				text: "{Subty} - {Text}",
				key: "{Subty}"

			});
			oSelectSubty.setModel(oModel);
			oSelectSubty.bindAggregation("items", {
				path: "/timeTransferSubtySet",
				template: oTemplateShifts,
				filters: [oEmpIdFilter, oUnitKeyFilter]
			});
		},

		onTimeTransferInputChange: function (oEvent) {
			this.TimeDirty = true;
		},

		onCreateTimeTransfer: function (oEvent) {
			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_timetransfer");
			var oBegdaPicker = sap.ui.getCore().byId("ld_dp_begda_timetransfer");
			var oEnddaPicker = sap.ui.getCore().byId("ld_dp_endda_timetransfer");
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oDate = sap.ui.getCore().byId("ld_dp_date");
			var oModel = this.getView().getModel();

			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var oInpAmount = sap.ui.getCore().byId("ld_inp_amount_timetransfer");
			var oObject = {};

			var vToggleMode = "create";
			var vAmount = oInpAmount.getValue();
			var vSubty = oSubtySelect.getSelectedItem().getKey();
			var vEmpId = oEmpSelect.getSelectedItem().getKey();
			var vDate = oDate.getDateValue();
			var vBegda = oBegdaPicker.getDateValue();
			var vEndda = oEnddaPicker.getDateValue();

			vDate = this.getFormattedDate(vDate);

			if (!vBegda) {
				oBegdaPicker.setValueState(sap.ui.core.ValueState.Error);
			} else if (!vEndda) {
				oEnddaPicker.setValueState(sap.ui.core.ValueState.Error);
			} else if (!vAmount) {
				oInpAmount.setValueState(sap.ui.core.ValueState.Error);
			} else {
				vBegda = this.getFormattedDate(vBegda);
				vEndda = this.getFormattedDate(vEndda);
				oInpAmount.setValueState(sap.ui.core.ValueState.None);
				oBegdaPicker.setValueState(sap.ui.core.ValueState.None);
				oEnddaPicker.setValueState(sap.ui.core.ValueState.None);

				oObject.EmpId = vEmpId;
				oObject.Begda = vBegda;
				oObject.Endda = vEndda;
				oObject.Subty = vSubty;
				oObject.Amount = parseFloat(vAmount).toFixed(2);
				oObject.Seqnr = "0";

				oModel.create("/timeTransferSet", oObject, {
					success: function (oData) {
						var vCreated = oResourceBundle.getText("timetransfercreated");
						MessageToast.show(vCreated);
						this.getTimeTransfer();
					}.bind(this),
					error: this.createError.bind(this)
				});

				this.toggleTimeTransferButtons(vToggleMode);

				this.TimeDirty = false;
			}

		},

		onTimeTransferEntrySelect: function (oEvent) {
			if (oEvent.getSource().getSelectedIndex() == -1) {
				return;
			}
			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_timetransfer");
			var oInpAmount = sap.ui.getCore().byId("ld_inp_amount_timetransfer");
			var oBegdaPicker = sap.ui.getCore().byId("ld_dp_begda_timetransfer");
			var oEnddaPicker = sap.ui.getCore().byId("ld_dp_endda_timetransfer");
			var vToggleMode = "edit";

			var vBindingContext = oEvent.getSource().getContextByIndex(oEvent.getSource().getSelectedIndex());

			oSubtySelect.setSelectedKey(oEvent.getSource().getModel().getProperty("Subty", vBindingContext));
			oInpAmount.setValue(oEvent.getSource().getModel().getProperty("Amount", vBindingContext));
			// CEPOI_EXT 24.02.2021 >>>
			// oBegdaPicker.setValue(oEvent.getSource().getModel().getProperty("Begda", vBindingContext));
			// oEnddaPicker.setValue(oEvent.getSource().getModel().getProperty("Endda", vBindingContext));
			var vBegda = oEvent.getSource().getModel().getProperty("Begda", vBindingContext);
			var vEndda = oEvent.getSource().getModel().getProperty("Endda", vBindingContext);
			oBegdaPicker.setDateValue(new Date(vBegda.substr(6, 4), vBegda.substr(3, 2) - 1, vBegda.substr(0, 2)));
			oEnddaPicker.setDateValue(new Date(vEndda.substr(6, 4), vEndda.substr(3, 2) - 1, vEndda.substr(0, 2)));
			// <<<
			this.TimeDirty = true;

			this.toggleTimeTransferButtons(vToggleMode);
		},

		onUpdateTimeTransfer: function (oEvent) {

			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_timetransfer");
			var oInpAmount = sap.ui.getCore().byId("ld_inp_amount_timetransfer");
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oBegdaPicker = sap.ui.getCore().byId("ld_dp_begda_timetransfer");
			var oEnddaPicker = sap.ui.getCore().byId("ld_dp_endda_timetransfer");
			var oDate = sap.ui.getCore().byId("ld_dp_date");
			var oTable = sap.ui.getCore().byId("ld_tbl_timetransferoverview");
			var oModel = this.getView().getModel();
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var oObject = {};

			var vToggleMode = "create";
			var vAmount = oInpAmount.getValue();
			var vBegda = oBegdaPicker.getDateValue();
			var vEndda = oEnddaPicker.getDateValue();
			var vSubty = oSubtySelect.getSelectedItem().getKey();
			var vEmpId = oEmpSelect.getSelectedItem().getKey();
			var vDate = oDate.getDateValue();
			var oContext = oTable.getContextByIndex(oTable.getSelectedIndex());

			vDate = this.getFormattedDate(vDate);

			if (!vBegda) {
				oBegdaPicker.setValueState(sap.ui.core.ValueState.Error);
			} else if (!vEndda) {
				oEnddaPicker.setValueState(sap.ui.core.ValueState.Error);
			} else if (!vAmount) {
				oInpAmount.setValueState(sap.ui.core.ValueState.Error);
			} else {

				vBegda = this.getFormattedDate(vBegda);
				vEndda = this.getFormattedDate(vEndda);
				oInpAmount.setValueState(sap.ui.core.ValueState.None);
				oBegdaPicker.setValueState(sap.ui.core.ValueState.None);

				oEnddaPicker.setValueState(sap.ui.core.ValueState.None);

				oObject.EmpId = vEmpId;
				oObject.Begda = vBegda;
				oObject.Endda = vEndda;
				oObject.Subty = vSubty;
				oObject.Amount = parseFloat(vAmount).toFixed(2);
				oObject.Seqnr = oContext.getObject().Seqnr;

				oModel.update(oContext.sPath, oObject, {
					success: function (oData) {
						var vModified = oResourceBundle.getText("timetransfermodified");
						MessageToast.show(vModified);
						this.getTimeTransfer();
					}.bind(this),
					error: this.createError.bind(this)
				});

				this.toggleTimeTransferButtons(vToggleMode);

				this.TimeDirty = false;
			}
		},

		onDeleteTimeTransfer: function (oEvent) {
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_timetransfer");
			var oDate = sap.ui.getCore().byId("ld_dp_date");
			var oTable = sap.ui.getCore().byId("ld_tbl_timetransferoverview");
			var oModel = this.getView().getModel();
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var vToggleMode = "create";

			var oContext = oTable.getContextByIndex(oTable.getSelectedIndex());
			oModel.remove(oContext.sPath, {
				success: function (oData) {
					var vDeleted = oResourceBundle.getText("timetransferdeleted");
					MessageToast.show(vDeleted);
					this.getTimeTransfer();
				}.bind(this),
				error: this.createError.bind(this)
			});

			this.toggleTimeTransferButtons(vToggleMode);

			this.TimeDirty = false;
		},

		onCancelTimeTransfer: function (oEvent) {
			var vToggleMode = "create";

			this.toggleTimeTransferButtons(vToggleMode);
		},

		prepareSHAREPOINT: function (vUnitKey, bValid) {
			var oModel = this.getView().getModel();
			var oBegda = this.getSelectedBegda(); //sap.ui.getCore().byId("dp_excel_begda").getDateValue();
			var oEndda = this.getSelectedEndda(); //sap.ui.getCore().byId("dp_excel_endda").getDateValue();

			oBegda.setHours(12);
			oEndda.setHours(12);

			if (bValid != true) { //also check for validation feature 
				this.checkOpenMsgBeforeExport(oBegda, oEndda,
					"prepareSHAREPOINT",
					vUnitKey);
				return;
			}

			MessageToast.show(this.getResourceBundleText("mailwait"));
			oModel.callFunction("/SendToSharepoint", {
				method: "POST",
				urlParameters: {
					"UnitKey": vUnitKey,
					"Begda": oBegda,
					"Endda": oEndda
				},
				success: function () {
					MessageToast.show(this.getResourceBundleText("sharepointsuccess"));
				}.bind(this),
				error: function (oError) {
					this.createError(oError);
				}.bind(this)
			});
		},

		createNewQualification: function (oEvent) {
			var oModel = this.getView().getModel();
			var oDialog = this._oMaintQualDialog;
			var oRatingSelect = sap.ui.getCore().byId("ld_select_cd_rating");
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var oObject = {};

			oRatingSelect.setValueState(sap.ui.core.ValueState.None);
			oDialog.setBusy(true);
			oObject.UnitKey = Helper.getCustomDataValue(this._oMaintQualDialog.getAggregation("customData"), "UnitKey");
			oObject.Begda = sap.ui.getCore().byId("ld_dp_cd_begda").getDateValue();
			oObject.Begda.setHours(12);
			oObject.Endda = sap.ui.getCore().byId("ld_dp_cd_endda").getDateValue();
			oObject.Endda.setHours(12);
			oObject.QualId = sap.ui.getCore().byId("ld_select_cd_qualification").getSelectedKey();
			if (this.isFeatureEnabled("QUALSCALE")) {
				oObject.Rating = sap.ui.getCore().byId("ld_select_cd_rating").getSelectedKey();
			} else {
				if (this.getCustValue("QUAL_TYPE") != "PEP") {
					var aItems = oRatingSelect.getItems();
					try {
						oObject.Rating = aItems[aItems.length - 1].getKey();
					} catch (e) {
						oRatingSelect.setValueState(sap.ui.core.ValueState.Error);
						oDialog.setBusy(false);
						return;
					}
				}
			}
			oObject.EmpId = sap.ui.getCore().byId("ld_select_cq_employee").getSelectedKey();
			oModel.create("/qualForEmpSet", oObject, {
				refreshAfterChange: true,
				success: function (oData, oResponse) {
					var vSuccessMessage = oResourceBundle.getText("qualsaved");
					this.bindQualificationTable(sap.ui.getCore().byId("ld_select_cq_employee").getSelectedKey());
					oDialog.setBusy(false);
					MessageToast.show(vSuccessMessage);
				}.bind(this),
				error: function () {
					this.createError.bind(this);
					oDialog.setBusy(false);
				}.bind(this)
			});
		},

		deleteNewQualification: function () {
			var oModel = this.getView().getModel();
			var oDialog = this._oMaintQualDialog;
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var oTable = sap.ui.getCore().byId("ld_tbl_cd_overview");
			var oContext = oTable.getContextByIndex(oTable.getSelectedIndex());
			if (oContext) {
				oDialog.setBusy(true);
				oModel.remove(oContext.sPath, {
					success: function (oData, oResponse) {
						var vSuccessMessage = oResourceBundle.getText("qualdeleted");
						this.bindQualificationTable(sap.ui.getCore().byId("ld_select_cq_employee").getSelectedKey());
						oDialog.setBusy(false);
						MessageToast.show(vSuccessMessage);
					}.bind(this),
					error: function () {
						this.createError.bind(this);
						oDialog.setBusy(false);
					}.bind(this)
				});
			} else {
				MessageToast.show(this.getResourceBundleText("choosequalification"));
			}
		},

		closeMaintQualDialog: function () {
			this._oMaintQualDialog.close();
		},

		prepareMAINTQUAL: function (vUnitKey) {
			if (!this._oMaintQualDialog) {
				this._oMaintQualDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.ChangeQualification", this, {});
				this._oMaintQualDialog.attachAfterClose(this.destroyMaintQualPopup.bind(this));
				this.getView().addDependent(this._oMaintQualDialog);

				this._oMaintQualDialog.setBusyIndicatorDelay(0);
				this._oMaintQualDialog.setBusy(true);
				if (!this.isFeatureEnabled("QUALSCALE")) {
					sap.ui.getCore().byId("ld_select_cd_rating").setVisible(false);
					var aColumns = sap.ui.getCore().byId("ld_tbl_cd_overview").getColumns();
					for (var i = 0; i < aColumns.length; i++) {
						if (aColumns[i].getId() === "c_cd_rating") {
							aColumns[i].setVisible(false);
						}
					}
				}
			}

			this._oMaintQualDialog.addCustomData(new sap.ui.core.CustomData({
				key: "UnitKey",
				// writeToDom: true,
				value: vUnitKey
			}));
			var oPlanBegda = this.getSelectedBegda();
			// var oPlanEndda = this.getSelectedEndda();
			var oMaxDate = new Date("9999-12-31");
			var oBegda = sap.ui.getCore().byId("ld_dp_cd_begda");
			var oEndda = sap.ui.getCore().byId("ld_dp_cd_endda");
			oBegda.setDateValue(oPlanBegda);
			oEndda.setDateValue(oMaxDate);

			// var vUnitKey = Helper.getCustomDataValue(this._oMaintQualDialog.getAggregation("customData"), "UnitKey");
			var oEmpSelect = sap.ui.getCore().byId("ld_select_cq_employee");

			this.bindEmployeesToPicker(vUnitKey, oEmpSelect);
			this._oMaintQualDialog.open();
		},

		reloadNewQualification: function (oEvent) {
			if (oEvent.getParameter("selectedItem").getKey()) {
				oEvent.getSource().setSelectedItem(oEvent.getParameter("selectedItem"));
			}

			this.bindQualsToPicker();
			this.bindQualificationTable(sap.ui.getCore().byId("ld_select_cq_employee").getSelectedKey());
		},

		bindEmployeesToPicker: function (vUnitKey, oEmpSelect) {
			var oModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/MIND2/PEP_YEAR_SRV", {
				refreshAfterChange: true
			});
			var oTemplate = new sap.ui.core.Item({
				text: "{Name}",
				key: "{EmpId}"
			});
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oPlanBegda = this.getSelectedBegda();
			var oPlanEndda = this.getSelectedEndda();
			oPlanBegda.setUTCDate(oPlanBegda.getDate());
			oPlanEndda.setUTCDate(oPlanEndda.getDate());
			var vPlanBegda = this.getFormattedDate(oPlanBegda);
			var vPlanEndda = this.getFormattedDate(oPlanEndda);
			var oPlanBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, vPlanBegda);
			var oPlanEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, vPlanEndda);
			oEmpSelect.setModel(oModel);
			oEmpSelect.bindItems({
				path: "/EmployeeSet",
				template: oTemplate,
				filters: [oUnitFilter, oPlanBegdaFilter, oPlanEnddaFilter],
				events: {
					dataReceived: function () {
						if (oEmpSelect.getSelectableItems().length > 0) {
							oEmpSelect.setSelectedItem(oEmpSelect.getItems()[0]);
							this.bindQualsToPicker();
							this.bindQualificationTable(oEmpSelect.getSelectedKey());
							this._oMaintQualDialog.setBusy(false);
						}
					}.bind(this)
				}
			});
		},

		bindQualsToPicker: function () {
			var vUnitKey = Helper.getCustomDataValue(this._oMaintQualDialog.getAggregation("customData"), "UnitKey");
			var vEmpId = sap.ui.getCore().byId("ld_select_cq_employee").getSelectedKey();
			var oQualSelect = sap.ui.getCore().byId("ld_select_cd_qualification");
			var oModel = this.getView().getModel();

			if (this.oCustomizing.PlanHideQKey) {
				var oTemplate = new sap.ui.core.Item({
					text: "{QualText}",
					key: "{QualId}"
				});
			} else {
				var oTemplate = new sap.ui.core.Item({
					text: "{QualId} - {QualText}",
					key: "{QualId}"
				});
			}
			var oPlanBegda = this.getSelectedBegda();
			oPlanBegda.setUTCDate(oPlanBegda.getDate());
			var oPlanDateFilter = new sap.ui.model.Filter("PlanDate", sap.ui.model.FilterOperator.EQ, oPlanBegda);

			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			//var oEmpFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);

			oQualSelect.setModel(oModel);
			var oSelectedItem = oQualSelect.getSelectedItem();
			oQualSelect.bindItems({
				path: "/qualificationSet",
				template: oTemplate,
				filters: [oUnitFilter, oPlanDateFilter], //, oEmpFilter
				events: {
					dataReceived: function () {
						// oQualSelect.getItems()[0]
						// if (oQualSelect.getSelectableItems().length > 0) {
						if (oQualSelect.getItems().length > 0) {
							oQualSelect.setSelectedItem(oSelectedItem);
							// this.bindRatingToPicker();
						}
					}.bind(this)
				}
			});
		},

		bindRatingToPicker: function () {
			var oRatingSelect = sap.ui.getCore().byId("ld_select_cd_rating");
			var oModel = this.getView().getModel();
			var vQualId = sap.ui.getCore().byId("ld_select_cd_qualification").getSelectedKey();
			var oQualFilter = new sap.ui.model.Filter("QualId", sap.ui.model.FilterOperator.EQ, vQualId);
			var oTemplate = new sap.ui.core.Item({
				text: "{RatingText}",
				key: "{Rating}"
			});
			// oRatingSelect.setVisible(true);
			oRatingSelect.setModel(oModel);
			oRatingSelect.bindItems({
				path: "/ratingForQualSet",
				template: oTemplate,
				filters: [oQualFilter],
				events: {
					dataReceived: function () {}
				}
			});
		},

		// onBindQualicationTable: function (oEvent) {
		// 	if (oEvent.getParameter("selectedItem").getKey()) {
		// 		this.bindQualificationTable(oEvent.getParameter("selectedItem").getKey());
		// 	}
		// },

		bindQualificationTable: function (vEmpId) {
			var oModel = this.getView().getModel();
			if (!vEmpId) {
				vEmpId = sap.ui.getCore().byId("ld_select_cq_employee").getSelectedKey();
			}
			var oQualTable = sap.ui.getCore().byId("ld_tbl_cd_overview");
			var vUnitKey = Helper.getCustomDataValue(this._oMaintQualDialog.getAggregation("customData"), "UnitKey");
			var oBegDp = sap.ui.getCore().byId("ld_dp_cd_begda");
			var oEndDp = sap.ui.getCore().byId("ld_dp_cd_endda");

			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oEmpFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
			var vBegda = oBegDp.getDateValue();
			vBegda.setHours(12);
			var oBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, vBegda);
			var vEndda = oEndDp.getDateValue();
			vEndda.setHours(12);
			var oEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, vEndda);
			oQualTable.setModel(oModel);
			oQualTable.setBusyIndicatorDelay(0);
			oQualTable.setBusy(true);
			oQualTable.bindAggregation("rows", {
				refreshAfterChange: true,
				path: "/qualForEmpSet",
				filters: [oEmpFilter, oUnitFilter, oBegdaFilter, oEnddaFilter],
				events: {
					dataReceived: function () {
						oQualTable.setBusy(false);
					}.bind(this)
				}
			});
		},

		bindNewQualificationTable: function () {
			var oBegDp = sap.ui.getCore().byId("ld_dp_cd_begda");
			var oEndDp = sap.ui.getCore().byId("ld_dp_cd_endda");

			if (oBegDp && oEndDp) {
				this.bindQualificationTable();
			}

		},

		destroyMaintQualPopup: function () {
			this._oMaintQualDialog.destroy();
			this._oMaintQualDialog = null;
		},

		downloadExcel: function (vUnitKey, bValid) {
			if (bValid != true) { //also check for validation feature 
				this.checkOpenMsgBeforeExport(sap.ui.getCore().byId("dp_excel_begda").getDateValue(), sap.ui.getCore().byId("dp_excel_endda").getDateValue(),
					"downloadExcel",
					vUnitKey);
				return;
			}

			var vBegda = sap.ui.getCore().byId("dp_excel_begda").getDateValue();
			var vEndda = sap.ui.getCore().byId("dp_excel_endda").getDateValue();

			Date.prototype.toJSONLocal = function () {
				function addZ(n) {
					return (n < 10 ? 0 : "") + n;
				}
				return this.getFullYear() + "-" +
					addZ(this.getMonth() + 1) + "-" +
					addZ(this.getDate()) + "T12:00:00";
			};

			var oUrl = "/excelShiftPlanSet(UnitKey='" + vUnitKey + "',Begda=datetime'" + vBegda.toJSONLocal() + "',Endda=datetime'" +
				vEndda.toJSONLocal() +
				"')/$value";
			oUrl = "/sap/opu/odata/MIND2/PEP_PLANNER_SRV" + oUrl;

			window.open(oUrl, "_blank");
		},
		//22.02.2021 Mitarbeiter Excel Dialog
		downloadEmpExcel: function (vUnitKey, bValid) {
			// if (bValid != true) { //also check for validation feature 
			// 	this.checkOpenMsgBeforeExport(sap.ui.getCore().byId("dp_emp_excel_date").getDateValue(), sap.ui.getCore().byId("dp_emp_excel_date").getDateValue(),
			// 		"downloadEmpExcel",
			// 		vUnitKey);
			// 	return;
			// }

			var vBegda = sap.ui.getCore().byId("dp_emp_excel_date").getDateValue();
			var vEndda = vBegda;

			if (vBegda === null) {
				return;
			}

			Date.prototype.toJSONLocal = function () {
				function addZ(n) {
					return (n < 10 ? 0 : "") + n;
				}
				return this.getFullYear() + "-" +
					addZ(this.getMonth() + 1) + "-" +
					addZ(this.getDate()) + "T12:00:00";
			};

			var oUrl = "/empExcelShiftPlanSet(UnitKey='" + vUnitKey + "',Begda=datetime'" + vBegda.toJSONLocal() + "',Endda=datetime'" +
				vEndda.toJSONLocal() +
				"')/$value";
			oUrl = "/sap/opu/odata/MIND2/PEP_PLANNER_SRV" + oUrl;

			window.open(oUrl, "_blank");
		},

		checkOpenMsgBeforeExport: function (oBegda, oEndda, sSuccessMethod, vUnitKey) {
			var oModel = this.getView().getModel();
			var aMessages = [];
			var vSumKey = this.getCustValue("F_CHECKMSG");
			var oBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, oBegda);
			var oEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, oEndda);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oSumFilter = new sap.ui.model.Filter("SumKey", sap.ui.model.FilterOperator.EQ, vSumKey);

			oModel.read("/sumMessageSet", {
				filters: [oUnitFilter, oSumFilter, oBegdaFilter, oEnddaFilter],
				success: function (oData) {
					aMessages = oData.results;
					if (aMessages.length > 0) {
						var oDialogModel = new sap.ui.model.json.JSONModel();
						oDialogModel.setProperty("/messages", aMessages);
						var oItemTemplate = new sap.m.StandardListItem({
							title: {
								parts: ['PlanDate', 'MessageText'],
								formatter: function (oDate, sText) {
									var sFormattedDate = Formatter.formatDate(oDate);
									return sFormattedDate + " - " + sText;
								}.bind(this)
							}
						});
						var oDialog = new Dialog({
							title: "{i18n>openmsg}",
							content: new sap.m.List({
								items: {
									path: "/messages",
									template: oItemTemplate
								}
							}),
							beginButton: new sap.m.Button({
								type: sap.m.ButtonType.Accept,
								text: "{i18n>continue}",
								press: function () {
									this[sSuccessMethod](vUnitKey, true);
									oDialog.close();
								}.bind(this)
							}),
							endButton: new sap.m.Button({
								type: sap.m.ButtonType.Reject,
								text: "{i18n>ttcancel}",
								press: function () {
									oDialog.close();
								}
							}),
							afterClose: function () {
								oDialog.destroy();
							}
						});
						oDialog.setModel(oDialogModel);
						this.getView().addDependent(oDialog);
						oDialog.open();
					} else {
						this[sSuccessMethod](vUnitKey, true);
					}
				}.bind(this),
				error: function (oError) {}
			});

		},

		prepareROLLINGPLN: function (vUnitKey) {
			if (!this._oRollingPlan) {
				this._oRollingPlan = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.RollingPlan", this, {});
				this.getView().addDependent(this._oRollingPlan);

				this._oRollingPlan.setBusyIndicatorDelay(0);
				// this._oRollingPlan.setBusy(true);
			}
			var oModel = new sap.ui.model.json.JSONModel();
			// oModel.setProperty("/Begda", this.getSelectedBegda());
			// oModel.setProperty("/Endda", this.getSelectedEndda());
			oModel.setProperty("/PlanId", "");
			oModel.setProperty("/New", false);
			oModel.setProperty("/UnitKey", vUnitKey);

			this._oRollingPlan.setModel(oModel, "RollingPlanModel");
			this.loadRollingPlans();

			this._oRollingPlan.open();
		},
		loadRollingPlans: function () {
			var oSelect = sap.ui.getCore().byId('idRollingPlanSelect');
			var oModel = this._oRollingPlan.getModel("RollingPlanModel");
			var oDataModel = this.getView().getModel();
			var aFilters = [];

			oSelect.clearSelection();
			oSelect.setValue();
			oModel.setProperty("/PlanId", "");

			aFilters.push(new sap.ui.model.Filter("Begda", "EQ", oModel.getProperty("/Begda")));
			aFilters.push(new sap.ui.model.Filter("Endda", "EQ", oModel.getProperty("/Endda")));
			aFilters.push(new sap.ui.model.Filter("UnitKey", "EQ", oModel.getProperty("/UnitKey")));

			if (oModel.getProperty("/New")) {
				if (oModel.getProperty("/Copy")) return;
				oDataModel.read("/employeeSet", {
					filters: aFilters,
					success: function (data) {
						oModel.setProperty("/NewSet", data.results);
					}
				});
			} else {
				oSelect.getBinding('items').filter(aFilters);
				if (oSelect.getBinding('items').isSuspended()) oSelect.getBinding('items').resume();
			}
		},
		onRPCreateChange: function () {
			var oModel = this._oRollingPlan.getModel("RollingPlanModel");

			if (oModel.getProperty("/New")) {
				oModel.setProperty("/Copy", false);
				oModel.setProperty("/NewSet", []);
			}
		},
		onDateRangeUpdateChange: function (oEvent) {
			var dFrom = oEvent.getParameter("from");
			var dTo = oEvent.getParameter("to");
			var dToday = new Date();
			var oModel = this._oRollingPlan.getModel("RollingPlanModel");
			var oRB = this.getView().getModel("i18n").getResourceBundle();
			var oVariantControl = sap.ui.getCore().byId('idRollingPlanSelect');
			var dBegda = oVariantControl.getSelectedItem().getBindingContext().getProperty("Begda");
			var dEnnda = oVariantControl.getSelectedItem().getBindingContext().getProperty("Endda");

			oModel.setProperty("/bDateRangeErrorState", "None");
			oModel.setProperty("/bDateRangeErrorText", "");

			if (dBegda < dToday && dEnnda < dToday) {
				oModel.setProperty("/bDateRangeErrorState", "Error");
				oModel.setProperty("/bDateRangeErrorText", oRB.getText("no-changes-allowed"));
			}

			if (dBegda < dToday && dEnnda > dToday) {
				oModel.setProperty("/BegdaUpd", dBegda);
				if (dTo < dToday) {
					oModel.setProperty("/bDateRangeErrorState", "Error");
					oModel.setProperty("/bDateRangeErrorText", oRB.getText("rolling-plan-dateto-less-than-today"));
				}
			}
		},
		loadRollingPlan: function (oEvent) {
			var oBind = oEvent.getParameter("selectedItem").getBindingContext();
			var oModel = this._oRollingPlan.getModel("RollingPlanModel");
			var oList = sap.ui.getCore().byId('idRollPlanEmployees');
			var aFilters = [];

			oModel.setProperty("/BegdaUpd", oBind.getProperty("Begda"));
			oModel.setProperty("/EnddaUpd", oBind.getProperty("Endda"));
			oModel.setProperty("/bDateRangeErrorState", "None");
			oModel.setProperty("/bDateRangeErrorText", "");

			aFilters.push(new sap.ui.model.Filter("Begda", "EQ", oBind.getProperty("Begda")));
			aFilters.push(new sap.ui.model.Filter("Endda", "EQ", oBind.getProperty("Endda")));
			aFilters.push(new sap.ui.model.Filter("UnitKey", "EQ", oModel.getProperty("/UnitKey")));
			aFilters.push(new sap.ui.model.Filter("PlanId", "EQ", oBind.getProperty("PlanId")));

			oList.getBinding('items').filter(aFilters);

			if (oList.getBinding('items').isSuspended()) oList.getBinding('items').resume();
		},
		onRollingPlanVariantDelete: function () {
			var oSelect = sap.ui.getCore().byId('idRollingPlanSelect');
			var oDataModel = this.getView().getModel();
			var that = this;

			var oVariantControl = sap.ui.getCore().byId('idRollingPlanSelect');
			var dBegda = oVariantControl.getSelectedItem().getBindingContext().getProperty("Begda");
			var dEndda = oVariantControl.getSelectedItem().getBindingContext().getProperty("Endda");
			var dToday = new Date();

			if (dBegda < dToday) {
				if (dEndda < dToday) {
					MessageToast.show(that.getView().getModel("i18n").getResourceBundle().getText("no-deletion-past"));
					return;
				} else {
					MessageToast.show(that.getView().getModel("i18n").getResourceBundle().getText("no-deletion-ongoing"));
					return;
				}
			}

			Helper.openConfirmDialog("{i18n>areyousure}", "", "{i18n>yes}",
				function () {
					oDataModel.remove(oSelect.getSelectedItem().getBindingContext().getPath(), {
						success: function () {
							that.resetRollingPlan();
							that.loadRollingPlans();
						},
						error: function (oError) {
							var aErrorMsg = JSON.parse(oError.responseText).error.innererror.errordetails;
							MessageBox.error(aErrorMsg[0].message);
						}
					});
				}, null, this);
		},
		copyRollingPlan: function () {
			var oModel = this._oRollingPlan.getModel("RollingPlanModel");
			// var oDataModel = this.getView().getModel();
			var oList = sap.ui.getCore().byId('idRollPlanEmployees');
			// var aItems = oList.getItems();
			// var dBegda = oModel.getProperty("/Begda"),
			// 	dEndda = oModel.getProperty("/Endda");

			/*for(var i in aItems){
				var oCtx = aItems[i].getBindingContext();
				
				oDataModel.create({
					Begda: dBegda,
					Endda: dEndda,
					EmpId: oCtx.getProperty("EmpId"),
					UnitKey: oModel.getProperty("/UnitKey"),
					QualId: oCtx.getProperty("QualId")
				});
				
				this.resetRollingPlan();
			}*/

			var aContexts = [];
			oList.getBinding("items").getContexts().forEach(function (item) {
				aContexts.push(item.getObject());
			});

			oModel.setProperty("/NewSet", aContexts);
			oModel.setProperty("/New", true);
			oModel.setProperty("/Copy", true);
		},
		saveRollingPlan: function () {
			var oDataModel = this.getView().getModel();
			var oList = sap.ui.getCore().byId('idRollPlanEmployees');
			var oSelect = sap.ui.getCore().byId('idRollingPlanSelect');
			var oModel = this._oRollingPlan.getModel("RollingPlanModel");
			var dBegda = oModel.getProperty("/Begda");
			var dEndda = oModel.getProperty("/Endda");
			var that = this;

			if (oModel.getProperty("/New")) {
				var aItems = oModel.getProperty("/NewSet");

				dBegda.setHours(12);
				dEndda.setHours(12);

				oDataModel.create("/rollingPlanVariantSet", {
					UnitKey: oModel.getProperty("/UnitKey"),
					Begda: dBegda,
					Endda: dEndda
				}, {
					success: function (data) {
						aItems.forEach(function (item) {
							var oCtx = {
								PlanId: data.PlanId,
								Name: item.Name,
								UnitKey: item.UnitKey,
								EmpId: item.EmpId,
								QualId: item.QualId,
								Begda: dBegda,
								Endda: dEndda
							};
							oDataModel.create("/rollingPlanSet", oCtx);
						});
						that.resetRollingPlan();
						that.loadRollingPlans();
						MessageToast.show(that.getView().getModel("i18n").getResourceBundle().getText("rolling-plan-save-success"));
					},
					error: function (oError) {
						var aErrorMsg = JSON.parse(oError.responseText).error.innererror.errordetails;
						MessageBox.error(aErrorMsg[0].message);
					}
				});
			} else {
				if (oModel.getProperty("/bDateRangeErrorState") !== "None") {
					MessageToast.show(this.getView().getModel("i18n").getResourceBundle().getText("incorrect-date-rollingplan"));
					return;
				}

				var dBegdaUpd = oModel.getProperty("/BegdaUpd");
				var dEnddaUpd = oModel.getProperty("/EnddaUpd");
				var oSelVariant = oSelect.getSelectedItem();

				var oVariantControl = sap.ui.getCore().byId('idRollingPlanSelect');
				var dBeg = oVariantControl.getSelectedItem().getBindingContext().getProperty("Begda");
				var dToday = new Date();

				if (dBeg < dToday) {
					MessageToast.show(that.getView().getModel("i18n").getResourceBundle().getText("no-changes-allowed"));
					oDataModel.resetChanges();
					return;
				}

				dBegdaUpd.setHours(12);
				dEnddaUpd.setHours(12);

				oDataModel.setProperty(oSelVariant.getBindingContext().getPath() + "/Begda", dBegdaUpd);
				oDataModel.setProperty(oSelVariant.getBindingContext().getPath() + "/Endda", dEnddaUpd);

				oList.getItems().forEach(function (item) {
					oDataModel.setProperty(item.getBindingContextPath() + '/Begda', dBegdaUpd);
					oDataModel.setProperty(item.getBindingContextPath() + '/Endda', dEnddaUpd);
				});

				oDataModel.submitChanges({
					success: function (oData) {
						if (oData.__batchResponses[0].response === undefined) {
							MessageToast.show(that.getView().getModel("i18n").getResourceBundle().getText("saved"));
						} else {
							var aErrorMsgUpd = JSON.parse(oData.__batchResponses[0].response.body).error.innererror.errordetails;
							MessageBox.error(aErrorMsgUpd[0].message);
						}
					},
					error: function (oError) {
						var aErrorMsgUpd = JSON.parse(oError.responseText).error.innererror.errordetails;
						MessageBox.error(aErrorMsgUpd[0].message);
					}
				});
			}
		},
		resetRollingPlan: function () {
			var oModel = this._oRollingPlan.getModel("RollingPlanModel");
			var oSelect = sap.ui.getCore().byId('idRollingPlanSelect');

			oModel.setProperty("/New", false);
			oModel.setProperty("/NewSet", []);
			oModel.setProperty("/Copy", false);

			oSelect.clearSelection();
			oSelect.setValue();
		},
		closeRollingPlan: function () {
			this._oRollingPlan.close();
		},
		afterCloseRollingPlan: function () {
			this._oRollingPlan.destroy();
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

		onColumnFilter: function (oEvent) {
			var oColumn = oEvent.getSource()._column,
				oTable = oEvent.getSource()._table,
				sValue = oEvent.getSource().getValue(),
				oTemplate = oColumn.getTemplate(),
				that = this,
				sBind = "",
				aFilters = [];

			if (oTemplate instanceof sap.m.ComboBox) {
				sBind = oTemplate.getBindingPath("value");
			} else if (oTemplate instanceof sap.m.Text || oTemplate instanceof sap.m.Button) {
				sBind = oTemplate.getBindingPath("text");
			} else {
				sBind = oTemplate.getBindingPath("value");
			}

			if (!sBind) return;

			var removeCurrentFilter = function (aFilters, field) {
				for (var i = 0; i < aFilters.length; i++) {
					if (aFilters[i].sPath === field) {
						aFilters.splice(i, i + 1);
						i--;
					}
				}

				return aFilters;
			};

			var oDR = function () {
				that.setRowCount(oTable, oTable.getBinding("rows").aIndices);
				oTable.setCustomerRowCount(oTable.getVisibleRowCount());
				oTable.setVisibleRowCount(oTable.getBinding("rows").aIndices.length);
				oTable.getBinding("rows").detachChange(oDR);
			};

			oTable.getBinding("rows").attachChange(oDR);

			if (sValue) {
				aFilters = oTable.getBinding("rows").aFilters;
				if (!aFilters.length) aFilters = [];

				aFilters = removeCurrentFilter(aFilters, sBind);

				aFilters.push(new sap.ui.model.Filter(sBind, "Contains", sValue));
				oTable.getBinding("rows").filter(aFilters);
				oColumn.setFiltered(true);
			} else {
				aFilters = oTable.getBinding("rows").aFilters;
				if (!aFilters.length) aFilters = [];

				aFilters = removeCurrentFilter(aFilters, sBind);

				oTable.getBinding("rows").filter(aFilters);
				oColumn.setFiltered(false);
			}
		},

		onColumnMenu: function (oEvent) {
			var oColumn = oEvent.getParameter('column'),
				oTable = oEvent.getSource(),
				isDummy = oEvent.getParameter('column').getId().indexOf("DUMMY") != -1,
				isDateColumn = oEvent.getParameter('column').getId().indexOf("Dcol_") != -1,
				oMenu = new sap.ui.unified.Menu();

			if (!isDateColumn && isDummy) return;

			if (isDateColumn && this.isFeatureEnabled("COMMENT")) {
				var oMI = new sap.ui.unified.MenuItem({
					text: "{i18n>comments}",
					icon: "sap-icon://comment",
					select: this.onColumnSelect.bind(this)
				});
				oMenu.addItem(oMI);
				oMI._column = oColumn;
			}

			if (!isDummy) {
				var oMTFI = new sap.ui.unified.MenuTextFieldItem({
					label: "Filter",
					icon: "sap-icon://filter",
					select: this.onColumnFilter.bind(this)
				});
				oMenu.addItem(oMTFI);
				oMTFI._column = oColumn;
				oMTFI._table = oTable;
			}

			this.getView().addDependent(oMenu);

			var closeMenu = function () {
				if (oMenu.bOpen) oMenu.close();
				oColumn.detachColumnMenuOpen(closeMenu);
			};
			oColumn.attachColumnMenuOpen(closeMenu);

			var items = $("[data-sap-ui-colid='" + oColumn.getId() + "'][role='columnheader']");
			var item = $(items[items.length - 1]);
			var offset = $(item).offset();
			oMenu.openAsContextMenu({
				pageX: offset.left,
				pageY: offset.top + (!isDummy ? item.innerHeight() : 0)
			}, oColumn);
		},

		onColumnSelect: function (oEvent) {
			if (this.isFeatureEnabled("COMMENT")) {
				// var oCurrentColumn = oEvent.getParameter("column");
				var oCurrentColumn = oEvent.getSource()._column;
				this.openCommentPopupWrapper(oCurrentColumn);
			}
		},

		getFormattedDate: function (vDate) {
			var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "dd.MM.yyyy"
			});
			var vDateFormatted = oDateFormat.format(vDate);
			return vDateFormatted;
		},

		onCloseDialogByButton: function (oEvent) {
			var oDialog = oEvent.getSource().getParent();
			oDialog.close();
		},

		onChangeNoOfLines: function (oEvent) {
			this.oUserCust.Nooflines = oEvent.getSource().getValue();
			this.updateUserCustomizing();
		},

		onPressShowPlanOnly: function () {
			var sPnlId;
			var oPanel;
			var aContent;
			var oButton;
			var aToolbarContent;
			var oItem;
			var iCount;
			this.bPlanExpand = true;
			this.bSumExpand = false;
			for (var i = 0; i < this.aUnits.length; i++) {
				iCount = i;
				sPnlId = "pnl";
				sPnlId = sPnlId + this.aUnits[i].UnitKey;
				oPanel = sap.ui.getCore().byId(sPnlId);
				if (oPanel) {
					aToolbarContent = oPanel.getHeaderToolbar().getContent();
					for (var k = 0; k < aToolbarContent.length; k++) {
						oButton = aToolbarContent[k];
						if (oButton.getId().match("^btn_hideB") || oButton.getId().match("^btn_hideSB") || oButton.getId().match(
								"^btn_hideEmp_")) {
							oButton.setPressed(false);
						} else if (oButton.getId().match("^btn_hidePB")) {
							oButton.setPressed(true);
						}
					}
					if (!oPanel.getExpanded()) {
						oPanel.setExpanded(true);
					}
					aContent = oPanel.getContent()[0].getContent();
					for (var j = 0; j < aContent.length; j++) {
						oItem = aContent[j];
						if (!oItem.getId().match("^tbl_plan")) {
							oItem.setVisible(false);
						} else {
							if (oItem.getColumns().length === 0) {
								this.fillUnitTable(oItem, this.aUnits[iCount].UnitKey);
								oItem.setVisible(true);
							} else {
								oItem.setVisible(true);
								this.unitTableFinalService(oItem);
							}
						}
					}
				}

			}
		},

		onSearchEmployeePress: function () {
			if (!this._oSearchEmployeeDialog) {
				this._oSearchEmployeeDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.SearchEmployee", this, {
					refreshAfterChange: true
				});
				this.getView().addDependent(this._oSearchEmployeeDialog);
				this._oSearchEmployeeDialog.open();
				this._oSearchEmployeeDialog.attachAfterClose(this.destroySearchEmployeeDialog.bind(this));
			}
		},

		onJumpToEmployee: function (oEvent) {
			var oItem = sap.ui.getCore().byId("employeeSearchhelpId").getSelectedItem();
			var vEmpId = oItem.getBindingContext().getProperty("Pernr");
			var oPage = this.getView().byId("page");
			var oPanel;
			var oDialog = oEvent.getSource().getParent();
			oDialog.setBusy(true);
			// var oBegda = sap.ui.model.odata.ODataUtils.formatValue(new Date(this.getSelectedBegda()), "Edm.DateTime");
			// var oEndda = sap.ui.model.odata.ODataUtils.formatValue(new Date(this.getSelectedEndda()), "Edm.DateTime");
			this.getView().getModel().callFunction("/CheckAddUnit", {
				method: "GET",
				urlParameters: {
					"empId": vEmpId,
					"planBegda": this.getSelectedBegda(),
					"planEndda": this.getSelectedEndda()
				},
				success: function (oData) {
					oDialog.setBusy(false);
					$.when(this.addNewUnit(oData)).then(function () {
							$.when(this.createUnitTables()).then(function () {
								oPanel = sap.ui.getCore().byId("pnl" + oData.UnitKey);
								this._oSearchEmployeeDialog.close();
								$.when(this.expandPanel(oPanel)).then(function () {
									setTimeout(function () {
										oPage.scrollToElement(oPanel);
									}, 500);
								}.bind(this));
							}.bind(this), 1000);
						}.bind(this),
						function () {
							oPanel = sap.ui.getCore().byId("pnl" + oData.UnitKey);
							this._oSearchEmployeeDialog.close();
							$.when(this.expandPanel(oPanel)).then(function () {
								setTimeout(function () {
									oPage.scrollToElement(oPanel);
								}, 500);
							}.bind(this));
						}.bind(this));
				}.bind(this),
				error: function (oError) {
					oDialog.setBusy(false);
					this.createError(oError);
				}.bind(this)
			});
		},
		onJumpToTO: function (oEvent) {
			var oItem = sap.ui.getCore().byId("employeeSearchhelpId").getSelectedItem();
			var vEmpId = oItem.getBindingContext().getProperty("Pernr");
			vEmpId = vEmpId.padStart(10, "0");
			var oDialog = oEvent.getSource().getParent();
			oDialog.setBusy(true);
			// var oBegda = sap.ui.model.odata.ODataUtils.formatValue(new Date(this.getSelectedBegda()), "Edm.DateTime");
			// var oEndda = sap.ui.model.odata.ODataUtils.formatValue(new Date(this.getSelectedEndda()), "Edm.DateTime");
			this.getView().getModel().callFunction("/CheckAddUnit", {
				method: "GET",
				urlParameters: {
					"empId": vEmpId,
					"planBegda": this.getSelectedBegda(),
					"planEndda": this.getSelectedEndda()
				},
				success: function (oData) {
					oDialog.setBusy(false);
					var vDate = this.getSelectedBegda();
					var vUnitKey = oData.UnitKey;
					oItem = sap.ui.getCore().byId("employeeSearchhelpId").getSelectedItem();
					vEmpId = oItem.getBindingContext().getProperty("Pernr");
					vEmpId = vEmpId.padStart(10, "0");
					if (vEmpId) {
						this.getView().getModel().callFunction("/CheckEmployeeLocked", {
							method: "GET",
							urlParameters: {
								"empId": vEmpId,
								"planBegda": this.getSelectedBegda(),
								"planEndda": this.getSelectedEndda()
							},
							success: function () {
								this.openTimeOverviewPopup(vDate, vUnitKey, vEmpId);
							}.bind(this),
							error: function (oError) {
								var aErrorMsg = JSON.parse(oError.responseText).error.innererror.errordetails;
								Helper.openConfirmDialog("{i18n>warning}", aErrorMsg[0].message, "{i18n>openanyway}", function () {
										this.openTimeOverviewPopup(vDate, vUnitKey, vEmpId);
									}.bind(this),
									null, this);
							}.bind(this)
						});
					} else {
						this.openTimeOverviewPopup(vDate, vUnitKey, vEmpId);
					}
				}.bind(this),
				error: function (oError) {
					oDialog.setBusy(false);
					this.createError(oError);
				}.bind(this)
			});
		},

		addNewUnit: function (oData) {
			var oDeferred = $.Deferred();
			var oObject = {
				UnitKey: oData.UnitKey,
				UnitText: oData.UnitText
			};
			var bFound = false;

			for (var i = 0; i < this.aUnits.length; i++) {
				if (this.aUnits[i].UnitKey == oObject.UnitKey) {
					bFound = true;
					break;
				}
			}

			if (!bFound) {
				this.aUnits.push(oObject);
				oDeferred.resolve();
			} else {
				oDeferred.reject();
			}
			return oDeferred;
		},

		expandPanel: function (oPanel) {
			var oDeferred = $.Deferred();

			oPanel.setExpanded(true);
			oPanel.fireExpand({
				expand: true,
				triggeredByInteraction: true
			});

			oDeferred.resolve();
			return oDeferred;
		},

		destroySearchEmployeeDialog: function () {
			this._oSearchEmployeeDialog.destroy();
			this._oSearchEmployeeDialog = null;
		},

		onSearchEmployee: function () {
			var oViewModel = this.getOwnerComponent().getModel("searchedEmployee");
			var sLastname = oViewModel.getProperty("/lastnameSearch").toUpperCase();
			var sFirstname = oViewModel.getProperty("/firstnameSearch").toUpperCase();
			var sPernr = oViewModel.getProperty("/pernrSearch").toUpperCase();

			if (sLastname === "" && sFirstname === "" && sPernr === "") {
				oViewModel.setProperty("/validate", true);
				return;
			}
			oViewModel.setProperty("/validate", false);

			var oTable = sap.ui.getCore().byId("employeeSearchhelpId");
			var oPernr = new Text({
				text: "{Pernr}"
			});
			var oNachn = new Text({
				text: "{Nachn}"
			});
			var oVorna = new Text({
				text: "{Vorna}"
			});
			var oUnit = new Text({
				text: "{UnitKey} - {Unit}"
			});
			var oTemplate = new ColumnListItem({
				type: "Active"
			});
			oTemplate.addCell(oPernr);
			oTemplate.addCell(oNachn);
			oTemplate.addCell(oVorna);
			oTemplate.addCell(oUnit);

			var aFilter = [];
			var oFilterLastname = new sap.ui.model.Filter("Nachn", sap.ui.model.FilterOperator.Contains, sLastname);
			var oFilterFirstname = new sap.ui.model.Filter("Vorna", sap.ui.model.FilterOperator.Contains, sFirstname);
			if (sPernr !== "") {
				var oFilterPernr = new sap.ui.model.Filter("Pernr", sap.ui.model.FilterOperator.Contains, sPernr);
				aFilter.push(oFilterPernr);
			}

			// var oBegda = sap.ui.model.odata.ODataUtils.formatValue(new Date(this.getSelectedBegda()), "Edm.DateTime");
			// var oEndda = sap.ui.model.odata.ODataUtils.formatValue(new Date(this.getSelectedEndda()), "Edm.DateTime");

			// var oFilterBegda = new sap.ui.model.Filter("PlanBegda", sap.ui.model.FilterOperator.EQ, oBegda);
			// var oFilterEndda = new sap.ui.model.Filter("PlanEndda", sap.ui.model.FilterOperator.EQ, oEndda);

			aFilter.push(oFilterLastname);
			aFilter.push(oFilterFirstname);
			// aFilter.push(oFilterBegda);
			// aFilter.push(oFilterEndda);

			oTable.bindItems({
				path: "/searchedEmployeeSet",
				template: oTemplate,
				filters: aFilter,
				parameters: {
					operationMode: "Server"
				},
				events: {
					dataReceived: function (oData) {

					}.bind(this)
				}
			});

		},

		closeSearchEmployeeDialog: function () {
			this._oSearchEmployeeDialog.close();
		},

		onPressShowSumsOnly: function () {
			var sPnlId;
			var oPanel;
			var aContent;
			var oButton;
			var aToolbarContent;
			var oItem;
			var iCount;
			this.bSumExpand = true;
			this.bPlanExpand = false;
			for (var i = 0; i < this.aUnits.length; i++) {
				iCount = i;
				sPnlId = "pnl";
				sPnlId = sPnlId + this.aUnits[i].UnitKey;
				oPanel = sap.ui.getCore().byId(sPnlId);
				if (oPanel) {
					aToolbarContent = oPanel.getHeaderToolbar().getContent();
					for (var k = 0; k < aToolbarContent.length; k++) {
						oButton = aToolbarContent[k];
						if (oButton.getId().match("^btn_hideB") || oButton.getId().match("^btn_hidePB") || oButton.getId().match(
								"^btn_hideEmp_")) {
							oButton.setPressed(false);
						} else if (oButton.getId().match("^btn_hideSB")) {
							oButton.setPressed(true);
						}
					}
					if (!oPanel.getExpanded()) {
						oPanel.setExpanded(true);
					}
					aContent = oPanel.getContent()[0].getContent();
					for (var j = 0; j < aContent.length; j++) {
						oItem = aContent[j];
						if (!oItem.getId().match("^tbl_sum")) {
							oItem.setVisible(false);
						} else {
							if (oItem.getRows().length === 0) {
								this.fillSumTable(oItem, this.aUnits[iCount].UnitKey);
							}
							oItem.setVisible(true);
						}
					}
				}
			}
		},

		onPressCollapseAll: function () {
			var sPnlId;
			var oPanel;
			var aContent;
			var oItem;
			this.bSumExpand = true;
			this.bPlanExpand = true;
			for (var i = 0; i < this.aUnits.length; i++) {
				sPnlId = "pnl";
				sPnlId = sPnlId + this.aUnits[i].UnitKey;
				oPanel = sap.ui.getCore().byId(sPnlId);
				if (oPanel) {
					if (oPanel.getExpanded()) {
						aContent = oPanel.getContent()[0].getContent();
						// for (var j = 0; j < aContent.length; j++) {
						// 	oItem = aContent[j];
						// 	if (oItem.getId().match("^tbl")) {
						// 		// oItem.destroyColumns();
						// 		// oItem.setVisible(false);
						// 	}
						// }
						oPanel.setExpanded(false);
					}
				}
			}
		},

		rowHeightChange: function (oEvent) {
			this.oUserCust.Rowheight = oEvent.getSource().getSelectedKey();
			this.updateUserCustomizing();
			var sKey = oEvent.getSource().getSelectedKey();
			var oPlanTable;
			var sPlanTable;
			var oSumTable;
			var sSumTable;
			var i;
			var aUnits = this.aUnits;

			if (!aUnits) return;
			if (sKey === "CONDENSED") {
				for (i = 0; i < aUnits.length; i++) {
					sPlanTable = "tbl_plan_" + aUnits[i].UnitKey;
					oPlanTable = sap.ui.getCore().byId(sPlanTable);
					oPlanTable.removeStyleClass("normalTable");
					oPlanTable.removeStyleClass("wideTable");
					oPlanTable.addStyleClass("narrowTable");
					oPlanTable.setRowHeight(35);

					sSumTable = "tbl_sum_" + aUnits[i].UnitKey;
					oSumTable = sap.ui.getCore().byId(sSumTable);
					oSumTable.removeStyleClass("normalTable");
					oSumTable.removeStyleClass("wideTable");
					oSumTable.addStyleClass("narrowTable");
					oSumTable.setRowHeight(35);
				}
			} else if (sKey === "COMPACT") {
				for (i = 0; i < aUnits.length; i++) {
					sPlanTable = "tbl_plan_" + aUnits[i].UnitKey;
					oPlanTable = sap.ui.getCore().byId(sPlanTable);
					oPlanTable.removeStyleClass("narrowTable");
					oPlanTable.removeStyleClass("wideTable");
					oPlanTable.addStyleClass("normalTable");
					oPlanTable.setRowHeight(40);

					sSumTable = "tbl_sum_" + aUnits[i].UnitKey;
					oSumTable = sap.ui.getCore().byId(sSumTable);
					oSumTable.removeStyleClass("narrowTable");
					oSumTable.removeStyleClass("wideTable");
					oSumTable.addStyleClass("normalTable");
					oSumTable.setRowHeight(40);
				}
			} else if (sKey === "COZY") {
				for (i = 0; i < aUnits.length; i++) {
					sPlanTable = "tbl_plan_" + aUnits[i].UnitKey;
					oPlanTable = sap.ui.getCore().byId(sPlanTable);
					oPlanTable.removeStyleClass("narrowTable");
					oPlanTable.removeStyleClass("normalTable");
					oPlanTable.addStyleClass("wideTable");
					oPlanTable.setRowHeight(45);

					sSumTable = "tbl_sum_" + aUnits[i].UnitKey;
					oSumTable = sap.ui.getCore().byId(sSumTable);
					oSumTable.removeStyleClass("narrowTable");
					oSumTable.removeStyleClass("normalTable");
					oSumTable.addStyleClass("wideTable");
					oSumTable.setRowHeight(45);
				}
			}
		},

		getTableStyleClass: function () {
			var sStyleClass;
			switch (this.oUserCust.Rowheight) {
			case "COMPACT":
				sStyleClass = "sapUiSizeCompact";
				return sStyleClass;
			case "CONDENSED":
				sStyleClass = "sapUiSizeCondensed";
				return sStyleClass;
			case "COZY":
				sStyleClass = "sapUiSizeCozy";
				return sStyleClass;
			}
		},

		panelExpandChange: function (oEvent) {
			if (!oEvent.getParameter("triggeredByInteraction")) return;
			this.oUserCust.CalDisabled = !oEvent.getSource().getExpanded();
			this.updateUserCustomizing();
		},

		updateUserCustomizing: function () {
			var oModel = this.getView().getModel();
			var oRecord = this.oUserCust;
			oModel.update("/userCustomizingSet('sy-uname')", oRecord, {});
		},

		msToTime: function (duration) {
			var milliseconds = parseInt((duration % 1000) / 100),
				seconds = Math.floor((duration / 1000) % 60),
				minutes = Math.floor((duration / (1000 * 60)) % 60),
				hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

			hours = (hours < 10) ? "0" + hours : hours;
			minutes = (minutes < 10) ? "0" + minutes : minutes;
			seconds = (seconds < 10) ? "0" + seconds : seconds;

			return hours + ":" + minutes;
		}
	});
});