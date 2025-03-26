sap.ui.define([], function () {
	"use strict";
	return {
		tableEmptyTime: function (sTime) {
			if (sTime !== "00:00") {
				return sTime;
			} else {
				sTime = "";
			}
		},

		tableBooleanText: function (vBoolean) {
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			switch (vBoolean) {
			case true:
				return oResourceBundle.getText("booltrue");
			case false:
				return oResourceBundle.getText("boolfalse");
			default:
				return vBoolean;
			}
		},

		tableCycLeaveTypeText: function (vType) {
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			switch (vType) {
			case "1":
				return oResourceBundle.getText("daily");
			case "2":
				return oResourceBundle.getText("weekly");
			case "3":
				return oResourceBundle.getText("monthly");
			default:
				return vType;
			}
		},

		deleteLeadingZeros: function (vEmpId) {
			var vInt = parseInt(vEmpId, 10);
			vEmpId = vInt.toString();
			return vEmpId;
		},

		getPanelVisibility: function (sPanelId, oController) {
			switch (sPanelId) {
			case "pnl_absence":
				if (oController.isFeatureEnabled("TO_ABS")) {
					return true;
				} else {
					return false;
				}
			case "pnl_shift":
				if (oController.isFeatureEnabled("TO_SHIFT")) {
					return true;
				} else {
					return false;
				}
			case "pnl_cico":
				if (oController.isFeatureEnabled("TO_CICO")) {
					return true;
				} else {
					return false;
				}
			case "pnl_overtime":
				if (oController.isFeatureEnabled("TO_OVERT")) {
					return true;
				} else {
					return false;
				}
			case "pnl_allowance":
				if (oController.isFeatureEnabled("TO_ALLOW")) {
					return true;
				} else {
					return false;
				}
			case "pnl_timetransfer":
				if (oController.isFeatureEnabled("TO_TIMET")) {
					return true;
				} else {
					return false;
				}
			case "pnl_rptime":
				if (oController.isFeatureEnabled("TO_RPTIME")) {
					return true;
				} else {
					return false;
				}
			default:
				return true;
			}
		},

		getRptimeMessageText: function (bError, oController) {
			var oResourceBundle = oController.getView().getModel("i18n").getResourceBundle();
			if (bError) {
				return oResourceBundle.getText("rptimeerror");
			} else {
				return oResourceBundle.getText("rptimegood");
			}
		},

		formatDate: function (oDate) {
			var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "dd.MM.yyyy"
			});
			return oDateFormat.format(oDate);
		},

		checkCustomDataIsString: function (value) {
			if (value && typeof (value) === "string") {
				return value;
			} else {
				if (typeof (value) === "number") {
					return value.toString();
				}
				return "";
			}
		}
	};
});