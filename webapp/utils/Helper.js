/*
 * Copyright (C) 2009-2018 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/base/Object"
], function (UI5Object) {
	"use strict";

	var Helper = UI5Object.extend("MIND2PEP_PLANNER.utils.Helper", {});

	Helper.getCustomDataValue = function (aCustomData, vKey) {
		for (var i = 0; i < aCustomData.length; i++) {
			if (aCustomData[i].getProperty("key") == vKey) {
				return aCustomData[i].getProperty("value");
			}
		}
	};

	Helper.autoResize = function (oTable) {
		var aColumns = oTable.getColumns();
		var aRows = oTable.getRows();
		var bNoAutoResize = true;

		var fColumnFocus = sap.ui.table.Column.prototype.focus;

		sap.ui.table.Column.prototype.focus = function () {};
		
		var oEventAfterRender = {
			onAfterRendering: function(e) {
				e.srcControl.setBusy(false);
				e.srcControl.removeEventDelegate(oEventAfterRender);
			}
		};
		oTable.addEventDelegate(oEventAfterRender);
		
		for (var i = aColumns.length - 1; i >= 0; i--) {
			if (aColumns[i].getWidth() === 'auto') {
				oTable.autoResizeColumn(i);
				bNoAutoResize = false;
			}
		}

		sap.ui.table.Column.prototype.focus = fColumnFocus;

		if (!oTable.getVisible()) {
			oTable.setVisible(true);
		}
		
		if(bNoAutoResize) {
			oTable.setBusy(false);
		}

		/*if (aRows.length > 0) {
			oTable.setBusy(false);
		}*/
	};

	Helper.openConfirmDialog = function (vTitle, vText, vTxtYes, fOk, fCancel, oController) {
		var vTxtCancel = "{i18n>cancelunsavedchanges}";
		var oVBox = new sap.m.VBox({
			alignItems: "Center",
			justifyContent: "Center",
			items: [new sap.m.Text({
				text: vText
			})]
		});
		var oDialog = new sap.m.Dialog({
			title: vTitle,
			content: [oVBox],
			beginButton: new sap.m.Button({
				text: vTxtYes,
				type: sap.m.ButtonType.Emphasized,
				press: function () {
					if (fOk) {
						fOk(oController);
					}
					oDialog.close();
					oDialog.destroy();
				}
			}),
			endButton: new sap.m.Button({
				text: vTxtCancel,
				press: function () {
					if (fCancel) {
						fCancel(oController);
					}
					oDialog.close();
					oDialog.destroy();
				}
			})
		});
		oController.getView().addDependent(oDialog);
		oDialog.open();
	};

	Helper.openNoSelectedEntryDialog = function (vTitle, vText, fOk, oController) {
		var vTxtOk = "{i18n>ok}";
		var oVBox = new sap.m.VBox({
			alignItems: "Center",
			justifyContent: "Center",
			items: [new sap.m.Text({
				text: vText
			})]
		});
		var oDialog = new sap.m.Dialog({
			title: vTitle,
			content: [oVBox],
			beginButton: new sap.m.Button({
				text: vTxtOk,
				icon: "sap-icon://accept",
				type: sap.m.ButtonType.Accept,
				press: function () {
					oDialog.close();
					oDialog.destroy();
				}
			})
		});
		oController.getView().addDependent(oDialog);
		oDialog.open();
	};

	Helper.attachCalendarWeekSelection = function (weeks, oCal) {
		if (!weeks) {
			return;
		}
		weeks.onclick = function (event) {
			var iWeek = event.target.attributes["data-sap-ui-week"].nodeValue;
			var dCurDate = oCal._oFocusedDate._oUDate;

			var dSample = new Date(dCurDate.getFullYear(), 0, 1 + (iWeek - 1) * 7);
			var dow = dSample.getDay();
			var dBegda = dSample;

			if (dow <= 4) {
				dBegda.setDate(dSample.getDate() - dSample.getDay() + 1);
			} else {
				dBegda.setDate(dSample.getDate() + 8 - dSample.getDay());
			}

			var dEndda = new Date(dBegda.getFullYear(), dBegda.getMonth(), dBegda.getDate() + 6);

			if (oCal.getSelectedDates()[0]) {
				oCal.getSelectedDates()[0].setStartDate(dBegda);
				oCal.getSelectedDates()[0].setEndDate(dEndda);
			}

			setTimeout(function () {
				//WORKAROUND: In 1.52 calendar destroys weeks instead of rerendering
				// event.target.classList.add('selectedWeek');
				$("[data-sap-ui-week='" + iWeek + "']")[0].classList.add('selectedWeek');
			}, 50);

			oCal.fireSelect();
		};
	};

	Helper.addStyleClass = function (style) {
		//getting current style in head
		var css = $('head')[0].getElementsByTagName('style')[0];
		//or if there's none - create one
		if (!css) {
			css = document.createElement('style');
			css.type = 'text/css';
			$('head')[0].appendChild(css);
		}

		if (css.styleSheet) {
			css.styleSheet.cssText = style;
		} else {
			css.appendChild(document.createTextNode(style));
		}
	};

	return Helper;
});