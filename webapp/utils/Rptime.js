/*
 * Copyright (C) 2009-2018 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/base/Object"
], function (ui5Object) {
	"use strict";

	var _oInstance;

	var RptimeUtil = ui5Object.extend("MIND2PEP_PLANNER.utils.Rptime", {
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

		getData: function (oController, vUnitKey) {

			var oDeferred = $.Deferred();

			var _oRptime = oController._oRptime;

			this._oModel.callFunction("/RptimeLogCount", {
				method: "GET",
				urlParameters: {
					"UnitKey": vUnitKey
				},
				success: function (oData) {
					if(oData.results) _oRptime.addItemsToBuffer(oData.results);
					oDeferred.resolve(vUnitKey);
				},
				error: function () {
					oDeferred.reject();
				}
			});

			return oDeferred;
		},

		getItems: function (vUnitKey, oTemplate) {
			// Previous request is still pending?
			if (this._oPendingRequest[vUnitKey]) {
				// Wait for previous request to complete, then retry
				return this._oPendingRequest[vUnitKey].then(function () {
					this._oPendingRequest[vUnitKey] = undefined;
					return this.getItems(vUnitKey, oTemplate);
				}.bind(this));
			}

			//oData request
			this._oPendingRequest[vUnitKey] = $.Deferred();

			if (this.getItemsFromBuffer(vUnitKey).length > 0) {
				this._oPendingRequest[vUnitKey].resolve({
					aItems: this.getItemsFromBuffer(vUnitKey),
					oTemplate: oTemplate
				});
				return this._oPendingRequest[vUnitKey];
			}

			this._oModel.callFunction("/RptimeLogCount", { //hier
				method: "GET",
				urlParameters: {
					"UnitKey": vUnitKey
				},
				success: function (oData) {
					var oItem = {};
					oItem.UnitKey = vUnitKey;
					oItem.Amount = oData.Amount;
					this.addItemsToBuffer(oItem);
					this._oPendingRequest[vUnitKey].resolve({
						aItems: this.getItemsFromBuffer(vUnitKey),
						oTemplate: oTemplate
					});
				}.bind(this),
				error: function () {
					this._oPendingRequest[vUnitKey].reject();
				}.bind(this)
			});

			return this._oPendingRequest[vUnitKey];

		},

		addItemsToBuffer: function (oItem) {
			this._oBuffer.aItems.push(oItem);
		},

		getItemsFromBuffer: function (vUnitKey) {
			var aReturn = [];
			for (var i = 0; i < this._oBuffer.aItems.length; i++) {
				if (this._oBuffer.aItems[i].UnitKey == vUnitKey) {
					aReturn.push(this._oBuffer.aItems[i]);
				}
			}
			return aReturn;
		},

		refreshBuffer: function (vUnitKey, oTemplate) {
			if (this._oPendingRequest[vUnitKey]) {
				// Wait for previous request to complete, then retry
				return this._oPendingRequest[vUnitKey].then(function () {
					this._oPendingRequest[vUnitKey] = undefined;
					return this.refreshBuffer(vUnitKey, oTemplate);
				}.bind(this));
			}

			//oData request
			this._oPendingRequest[vUnitKey] = $.Deferred();

			if (this.getItemsFromBuffer(vUnitKey).length > 0) {
				this._oPendingRequest[vUnitKey].resolve({
					aItems: this.getItemsFromBuffer(vUnitKey),
					oTemplate: oTemplate
				});
				return this._oPendingRequest[vUnitKey];
			}

			this._oModel.callFunction("/RptimeLogCount", { //hier
				method: "GET",
				urlParameters: {
					"UnitKey": vUnitKey
				},
				success: function (oData) {
					var oItem = {};
					oItem.UnitKey = vUnitKey;
					oItem.Amount = oData.Amount;
					oItem.Finish = oData.Finish;
					if (oData.Finish === true) {
						this.addItemsToBuffer(oItem);
					}
					this._oPendingRequest[vUnitKey].resolve({
						aItems: this.getItemsFromBuffer(vUnitKey),
						oTemplate: oTemplate
					});
				}.bind(this),
				error: function () {
					this._oPendingRequest[vUnitKey].reject();
				}.bind(this)
			});

			return this._oPendingRequest[vUnitKey];
		},

		clearBuffer: function (vUnitKey) {
			// var oDeferred = $.Deferred();
			var iSplicePos = 0;
			for (var i = 0; i < this._oBuffer.aItems.length; i++) {
				if (this._oBuffer.aItems[iSplicePos].UnitKey == vUnitKey) {
					this._oBuffer.aItems.splice(iSplicePos, 1);
				} else {
					iSplicePos++;
				}
			}
			// return oDeferred;
		}
	});

	RptimeUtil.getInstance = function (sEmployeeId, oModel) {
		// No previous instance exists or assignment changed?
		if (!_oInstance || _oInstance._sEmployeeId !== sEmployeeId || _oInstance._oModel !== oModel) {
			// Create new instance
			_oInstance = new RptimeUtil(sEmployeeId, oModel);
		}

		return _oInstance;
	};

	return RptimeUtil;
});