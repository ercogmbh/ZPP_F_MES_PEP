sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/Filter",
	"sap/m/MessageBox",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageToast"
], function (Controller, Filter, MessageBox, FilterOperator, MessageToast) {
	"use strict";

	return Controller.extend("MIND2PEP_PLANNER.controller.FragmentExportRosterPDF", {
		parent: null,

		constructor: function (oParent) {
			this.oParent = oParent;
			
			var oModel = this.oParent.getView().getModel("roster");
			var oSelected = this.oParent.getView().getModel("Selected");
			oModel.callFunction("/getUserData", {
					method: "GET",
					success: function (data) {
						oSelected.setProperty("/CurrentPernr", data.getUserData.EmpId);
					},
					error: function (e) {
						MessageBox.error("Error occured: " + JSON.parse(e.responseText).error.message.value);
					}
				});
			return Controller.call(this);
		},

		onPDFSearchPress: function () {
			var oModel = this.oParent.getView().getModel("roster"),
				oSelected = this.oParent.getView().getModel("Selected"),
				sUser,
				dBegda,
				dEndda,
				message;

			if (!oSelected.getProperty("/Begda") || !oSelected.getProperty("/Endda") || !oSelected.getProperty("/DocId")) {
				message = this.oParent.getView().getModel("i18n").getResourceBundle().getText("fill-fields-warning");
				MessageToast.show(message);
				return;
			}
			
			if (oSelected.getProperty("/Ess")) {
				sUser = oSelected.getProperty("/Pernr");
			} else {
				sUser = oSelected.getProperty("/CurrentPernr");
			}

			if (!sUser) {
				message = this.oParent.getView().getModel("i18n").getResourceBundle().getText("user-undefined");
				MessageBox.error(message);
				return;
			}

			dBegda = oSelected.getProperty("/Begda");
			dEndda = oSelected.getProperty("/Endda");

			var sPDF = oModel.createKey("PDFSet", {
				Pernr: sUser,
				Endda: dEndda,
				Begda: dBegda,
				DocId: oSelected.getProperty("/DocId")
			});

			oSelected.setProperty("/PDF", oModel.sServiceUrl + "/" + sPDF + "/$value");
			oSelected.setProperty("/PDFVisible", true);

		},

		onPDFExportClose: function () {
			this.oParent.onCloseRosterDialog();
			this.oParent.getView().getModel("Selected").setData({});
		},

		onSuggest: function (oEvent) {
			var sTerm = oEvent.getParameter("suggestValue").toUpperCase();
			var aFilters = [];
			if (sTerm) {
				//aFilters.push(new Filter("Vorna", FilterOperator.Contains, sTerm));
				aFilters.push(new Filter("Nachn", FilterOperator.Contains, sTerm));
			}

			oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
		},

		onDocTypeChange: function (oEvent) {
			
			var oSelected = this.oParent.getView().getModel("Selected");
			var sPath =  oEvent.getSource().getSelectedItem().getBindingContext("roster").getPath();
			var oSelectedItem = this.oParent.getView().getModel("roster").getProperty(sPath);

			oSelected.setProperty("/Ess", oSelectedItem.Ess);
			// if (!oSelectedItem.Ess && !oSelected.getProperty("/CurrentPernr")) {
				
			// }

		}

	});

});