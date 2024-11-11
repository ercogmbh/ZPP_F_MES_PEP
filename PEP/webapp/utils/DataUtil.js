/*
 * Copyright (C) 2009-2018 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/base/Object"
], function (ui5Object) {
	"use strict";

	var _oInstance;

	var DataUtil = ui5Object.extend("MIND2PEP_PLANNER.utils.DataUtil", {
		constructor: function (oModel) {
			this._oModel = oModel;
			this._oPendingRequest = [];
			this.refresh(); // initialize buffer
		},

		refresh: function () {
			this._oBuffer = {
				aItems: []
			};
		},

		getData: function (oController, aUnits) {
			var oDeferred = $.Deferred();
			var oFilter;
			var aFilters = [];
			for (var i = 0; i < aUnits.length; i++) {
				oFilter = new sap.ui.model.Filter("UnitKey", "EQ", aUnits[i].UnitKey);
				aFilters.push(oFilter);
			}
			var _oDataUtil = oController._oDataUtil;
			this._oModel.read("/valueHelpSet", {
				filters: aFilters,
				success: function (oData) {
					_oDataUtil.addItemsToBuffer(oData.results);
					oDeferred.resolve();
				},
				error: function () {
					oDeferred.reject();
				}
			});
			return oDeferred;
		},

		getItems: function (vItemKey, vUnitKey, oTemplate) {
			// Previous request is still pending?
			if (this._oPendingRequest[vItemKey + vUnitKey]) {
				// Wait for previous request to complete, then retry
				return this._oPendingRequest[vItemKey + vUnitKey].then(function () {
					this._oPendingRequest[vItemKey + vUnitKey] = undefined;
					return this.getItems(vItemKey, vUnitKey, oTemplate);
				}.bind(this));
			}

			//oData request

			this._oPendingRequest[vItemKey + vUnitKey] = $.Deferred();

			var oFilter = new sap.ui.model.Filter("FieldKey", "EQ", vItemKey);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", "EQ", vUnitKey);

			if (this.getItemsFromBuffer(vItemKey, vUnitKey).length > 0) {
				this._oPendingRequest[vItemKey + vUnitKey].resolve({
					aItems: this.getItemsFromBuffer(vItemKey, vUnitKey),
					oTemplate: oTemplate
				});
				return this._oPendingRequest[vItemKey + vUnitKey];
			}

			this._oModel.read("/valueHelpSet", {
				filters: [oFilter, oUnitFilter],
				success: function (oData) {
					// Add read data to buffer
					this.addItemsToBuffer(oData.results);
					this._oPendingRequest[vItemKey + vUnitKey].resolve({
						aItems: this.getItemsFromBuffer(vItemKey, vUnitKey),
						oTemplate: oTemplate
					});
				}.bind(this),
				error: function () {
					this._oPendingRequest[vItemKey + vUnitKey].reject();
				}
			});

			return this._oPendingRequest[vItemKey + vUnitKey];

		},

		addItemsToBuffer: function (aItems) {
			for (var i = 0; i < aItems.length; i++) {
				this._oBuffer.aItems.push(aItems[i]);
			}
		},

		getItemsFromBuffer: function (vItemKey, vUnitKey) {
			var aReturn = [];
			for (var i = 0; i < this._oBuffer.aItems.length; i++) {
				if (this._oBuffer.aItems[i].FieldKey == vItemKey && this._oBuffer.aItems[i].UnitKey == vUnitKey) {
					aReturn.push(this._oBuffer.aItems[i]);
				}
			}
			return aReturn;
		}

	});

	DataUtil.getInstance = function (sEmployeeId, oModel) {
		// No previous instance exists or assignment changed?
		if (!_oInstance || _oInstance._sEmployeeId !== sEmployeeId || _oInstance._oModel !== oModel) {
			// Create new instance
			_oInstance = new DataUtil(sEmployeeId, oModel);
		}

		return _oInstance;
	};

	return DataUtil;
});