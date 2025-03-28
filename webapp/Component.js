sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"MIND2PEP_PLANNER/model/models"
], function (UIComponent, Device, models) {
	"use strict";

	return UIComponent.extend("MIND2PEP_PLANNER.Component", {

		metadata: {
			manifest: "json",
			config: {
				fullWidth: true
			}
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @public
		 * @override
		 */
		init: function () {

			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);

			// // enable routing
			// this.getRouter().initialize();

			// set the device model
			this.setModel(models.createDeviceModel(), "device");

			//set JSON model for comments
			this.setModel(new sap.ui.model.json.JSONModel("model/Comments.json"), "Comments");

			this.setModel(new sap.ui.model.json.JSONModel("model/TimStatView.json"), "TimStatView");
		}
	});
});