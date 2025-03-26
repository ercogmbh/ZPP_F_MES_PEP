sap.ui.define([
	"sap/ui/core/mvc/Controller"
], function (Controller) {
	"use strict";

	return Controller.extend("MIND2PEP_PLANNER.controller.FragmentQualPick", {
		parent: null,

		constructor: function (oParent, vUnitKey, vEmpID, vDate) {
			this.oParent = oParent;
			this.vUnitKey = vUnitKey;
			this.vEmpID = vEmpID;
			this.vDate = vDate;

			return Controller.call(this);
		},

		onSaveButtonPress: function (oEvent) {
			this.oParent.getView().getModel().submitChanges({
				refreshAfterChange: true,
				success: function (oData) {}.bind(this),
				error: function (oError) {
					this.oParent.getView().getModel().resetChanges();
				}.bind(this)
			});

			this.oParent.closeQualDialog();
		},

		onCloseButtonPress: function () {
			this.oParent.getView().getModel().resetChanges();
			this.oParent.closeQualDialog();
		}

	});

});