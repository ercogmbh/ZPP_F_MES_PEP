sap.ui.define([
	"MIND2PEP_PLANNER/utils/Formatter",
	"MIND2PEP_PLANNER/utils/Helper",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	'sap/ui/core/BusyIndicator'
], function (Formatter, Helper, MessageToast, MessageBox, BusyIndicator) {
	"use strict";

	return {
		formatter: Formatter,
		_controller: "",
		setController: function (controller) {
			this._controller = controller;
		},
		openTimeOverviewPopup: function (iDate, iUnitKey, iEmpID, OnePanel) {
			BusyIndicator.show(0);
			if (!this._controller._oTimesOverviewDialog) {
				this._controller._oTimesOverviewDialog = sap.ui.xmlfragment("MIND2PEP_PLANNER.fragments.timesoverview.main", this, {
					refreshAfterChange: true
				});
				this._controller.getView().addDependent(this._controller._oTimesOverviewDialog);
			}

			this._controller._oTimesOverviewDialog.open();

			var oTimesModel = this._controller.getView().getModel("TO"),
				// dCurrentDate = new Date(iDate),
				oCalendarWeek = sap.ui.getCore().byId("inp_calendarWeek"),
				aWeekday = [
					this._controller.getResourceBundleText("sunday"),
					this._controller.getResourceBundleText("monday"),
					this._controller.getResourceBundleText("tuesday"),
					this._controller.getResourceBundleText("wednesday"),
					this._controller.getResourceBundleText("thursday"),
					this._controller.getResourceBundleText("friday"),
					this._controller.getResourceBundleText("saturday")
				],
				oPlanBegda,
				oPlanEndda,
				oUserData = this._controller.getView().getModel("UserData");
			
			if(iDate){
				oPlanBegda = new Date(iDate);
				oPlanEndda = new Date(iDate);
			} else {
				oPlanBegda = this._controller.getSelectedBegda();
				oPlanEndda = this._controller.getSelectedEndda();
			}

			// dCurrentDate.setHours(12);
			oPlanBegda.setHours(12);
			oPlanEndda.setHours(12);
			var dCurrentDate = oPlanBegda;
			
			oTimesModel.setProperty('/UnitKey', iUnitKey);
			oTimesModel.setProperty('/EmpId', iEmpID);
			oTimesModel.setProperty('/CurrentDate', oPlanBegda);
			oTimesModel.setProperty('/SecondCurrentDate', oPlanEndda);

			oPlanBegda.setUTCDate(oPlanBegda.getDate());
			oPlanEndda.setUTCDate(oPlanEndda.getDate());

			var vPlanBegda = this._controller.getFormattedDate(oPlanBegda),
				vPlanEndda = this._controller.getFormattedDate(oPlanEndda);

			var oPlanBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, vPlanBegda),
				oPlanEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, vPlanEndda),
				oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, iUnitKey),
				oSelectEmp = sap.ui.getCore().byId("ld_select_emp");
			var that = this;
			oSelectEmp.getBinding("items").attachDataReceived(function () {
				setTimeout(function () {
					that.onEmployeeChangeTimeOverview();
				}, 0);
			}.bind(this));
			
			oSelectEmp.getBinding("items").filter([oUnitFilter, oPlanBegdaFilter, oPlanEnddaFilter]);
			if (oSelectEmp.getBinding("items").isSuspended()) {
				oSelectEmp.getBinding("items").resume();
			}

			oSelectEmp.setSelectedKey(iEmpID);
			sap.ui.getCore().byId("ld_dp_currentDate").focus();

			var vWeekday = aWeekday[dCurrentDate.getDay()];
			var copiedDate = new Date(dCurrentDate.getTime());
			copiedDate.setUTCDate(copiedDate.getUTCDate() + 4 - (copiedDate.getUTCDay() || 7));
			var yearStart = new Date(Date.UTC(dCurrentDate.getUTCFullYear(), 0, 1));
			var vCalendarWeek = Math.ceil((((copiedDate - yearStart) / 86400000)) / 7);
			var vCalendarWeekValue = "KW " + vCalendarWeek + " - " + vWeekday;
			oCalendarWeek.setValue(vCalendarWeekValue);

			oTimesModel.setProperty("/TO_SHIFT", {IsActive: oUserData.getProperty("/features/TO_SHIFT/IsActive")});
			oTimesModel.setProperty("/TO_ALLOW", {IsActive: oUserData.getProperty("/features/TO_ALLOW/IsActive")});
			oTimesModel.setProperty("/TO_TIMET", {IsActive: oUserData.getProperty("/features/TO_TIMET/IsActive")});
			oTimesModel.setProperty("/TO_RPTIME", {IsActive: oUserData.getProperty("/features/TO_RPTIME/IsActive")});
			oTimesModel.setProperty("/TO_CICO", {IsActive: oUserData.getProperty("/features/TO_CICO/IsActive")});
			oTimesModel.setProperty("/TO_ABS", {IsActive: oUserData.getProperty("/features/TO_ABS/IsActive")});
			oTimesModel.setProperty("/TO_OVERT", {IsActive: oUserData.getProperty("/features/TO_OVERT/IsActive")});
			
			if(OnePanel){
				oTimesModel.setProperty("/TO_SHIFT", {IsActive: false});
				oTimesModel.setProperty("/TO_ALLOW", {IsActive: false});
				oTimesModel.setProperty("/TO_TIMET", {IsActive: false});
				oTimesModel.setProperty("/TO_RPTIME", {IsActive: false});
				oTimesModel.setProperty("/TO_CICO", {IsActive: false});
				oTimesModel.setProperty("/TO_ABS", {IsActive: false});
				oTimesModel.setProperty("/TO_OVERT", {IsActive: false});
				
				oTimesModel.setProperty("/" + OnePanel, {IsActive: true});
			}

			this.changeDatesInModel(oPlanBegda, oPlanEndda);

			this.getTimeEventSet(iUnitKey);
			BusyIndicator.hide();
		},
		getTimeEventSet: function (vUnitKey) {
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
		closeTimeOverviewDialogViaButton: function (oEvent) {
			var vDirty = this.onCloseTimeOverviewDialog(oEvent);
			if (vDirty) {
				Helper.openConfirmDialog("{i18n>areyousure}", vDirty, "{i18n>discard}", this.closeTimeOverviewDialog.bind(this), null,
					this._controller);
			} else {
				this._controller._oTimesOverviewDialog.close();
			}
		},
		onEmployeeChangeTimeOverview: function () {
			var oTimesModel = this._controller.getView().getModel("TO");
			
			if(oTimesModel.getProperty("/TO_ABS/IsActive")) this.onEmployeeSelect();
			if(oTimesModel.getProperty("/TO_SHIFT/IsActive")) this.getEmpShift();
			if(oTimesModel.getProperty("/TO_CICO/IsActive")) this.onCicoEmployeeChange();
			if(oTimesModel.getProperty("/TO_OVERT/IsActive")) this.onEmployeeOvertimeSelect();
			if(oTimesModel.getProperty("/TO_ALLOW/IsActive")) this.getAllowanceSet();
			if(oTimesModel.getProperty("/TO_TIMET/IsActive")) this.getTimeTransfer();
			if(oTimesModel.getProperty("/TO_RPTIME/IsActive")) this.bindRptimeMsgTimesOverview();
		},
		onEmployeeSelect: function () {
			var vEmpId = this._controller.getView().getModel("TO").getProperty("/EmpId");
			var vUnitKey = this._controller.getView().getModel("TO").getProperty("/UnitKey");
			var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var vSumKey = "";
			var oDate = this._controller.getView().getModel("TO").getProperty("/CurrentDate");
			// var oMsgTypeFilter = new sap.ui.model.Filter("MsgType", sap.ui.model.FilterOperator.EQ, vMessageType);
			var oDateFilter = new sap.ui.model.Filter("PlanDate", sap.ui.model.FilterOperator.EQ, oDate);
			var oSumFilter = new sap.ui.model.Filter("SumKey", sap.ui.model.FilterOperator.EQ, vSumKey);
			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_leave");
			var oAbsenceReasonSelect = sap.ui.getCore().byId("ld_select_subty_reason");
			var oBind = oAbsenceReasonSelect.getBinding("items");

			this.fillLeaveTable();
			oSubtySelect.getBinding("items").filter([oEmpIdFilter, oUnitFilter]);
			if (oSubtySelect.getBinding("items").isSuspended()) oSubtySelect.getBinding("items").resume();

			oBind.attachDataRequested(function () {
				oAbsenceReasonSelect.setBusy(true);
			});
			oBind.attachDataReceived(function () {
				oAbsenceReasonSelect.setBusy(false);
			});
			oBind.filter([oDateFilter, oUnitFilter, oSumFilter]);
			if (oBind.isSuspended()) oBind.resume();
		},
		fillLeaveTable: function () {
			var vDate1 = this._controller.getView().getModel("TO").getProperty("/CurrentDate");
			var vDate2 = this._controller.getView().getModel("TO").getProperty("/SecondCurrentDate");
			var oTable = sap.ui.getCore().byId("ld_tbl_leaveoverview"),
				oModel = this._controller.getView().getModel("TO"),
				oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, oModel.getProperty("/EmpId")),
				oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, oModel.getProperty("/UnitKey")),
				// oBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.LE, oModel.getProperty("/TO_ABS/ld_dp_begda_leave")),
				oBegdaFilter = new sap.ui.model.Filter("Begda", "EQ", vDate1),
				// oEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.GE, oModel.getProperty("/TO_ABS/ld_dp_endda_leave"));
				oEnddaFilter = new sap.ui.model.Filter("Endda", "EQ", vDate2);

			oTable.getBinding('rows').attachDataRequested(function () {
				oTable.setBusy(true);
			});
			oTable.getBinding('rows').attachDataReceived(function () {
				oTable.setBusy(false);
			});
			oTable.getBinding('rows').filter([oEmpIdFilter, oUnitFilter, oBegdaFilter, oEnddaFilter], "Application");
			if (oTable.getBinding('rows').isSuspended()) oTable.getBinding('rows').resume();
		},
		getEmpShift: function () {
			var oPanel = sap.ui.getCore().byId("pnl_shift");
			// var oDate = sap.ui.getCore().byId("ld_dp_date");
			// var vDate = oDate.getDateValue();
			// var vDate = this._controller.getView().getModel("TO").getProperty("/TO_CICO/ld_dp_date");
			var vDate1 = this._controller.getView().getModel("TO").getProperty("/CurrentDate");
			var vDate2 = this._controller.getView().getModel("TO").getProperty("/SecondCurrentDate");
			/*var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
				pattern: "yyyy-MM-ddTHH:mm:ss"
			});*/
			// var vDateFormatted = oDateFormat.format(vDate);
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oSelectedItem = oEmpSelect.getSelectedItem();

			if (oSelectedItem) {
				var vEmpId = oSelectedItem.getKey();
				// var aCustomData = oSelectedItem.getCustomData();
				// var vUnitKey = Helper.getCustomDataValue(aCustomData, "UnitKey");
				var vUnitKey = oSelectedItem.getBindingContext().getProperty("UnitKey");
				// var oDateFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, vDateFormatted);
				var oDateFilter = new sap.ui.model.Filter("Begda", "BT", vDate1, vDate2);
				var oDateTableFilter = new sap.ui.model.Filter("ShiftDate", "BT", vDate1, vDate2);
				var oShiftSelect = sap.ui.getCore().byId("ld_select_shift");
				var oTableShift = sap.ui.getCore().byId('ld_tbl_shiftoverview');
				var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
				var oEmpIdTableFilter = new sap.ui.model.Filter("Empid", sap.ui.model.FilterOperator.EQ, vEmpId);
				var oUnitKeyFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

				oPanel.setBusy(true);

				this._controller.getView().getModel("TO").setProperty("/TO_SHIFT/SelectedShift", false);
				oTableShift.getBinding("rows").filter([oEmpIdTableFilter, oDateTableFilter]);
				if (oTableShift.getBinding("rows").isSuspended()) oTableShift.getBinding("rows").resume();

				oShiftSelect.getBinding("items").attachDataReceived(function () {
					//TODO: Replace implementation
					// this.getCurrEmpShift(vEmpId, vDateFormatted);
					oPanel.setBusy(false);
				}.bind(this));

				oShiftSelect.getBinding("items").filter([oDateFilter, oEmpIdFilter, oUnitKeyFilter]);
				if (oShiftSelect.getBinding("items").isSuspended()) oShiftSelect.getBinding("items").resume();
			}
		},
		onShiftSelection: function (oEvent) {
			var vEmpId = this._controller.getView().getModel("TO").getProperty("/EmpId");

			if (!oEvent.getParameter("rowContext")) return;

			var oDate = oEvent.getParameter("rowContext").getProperty("ShiftDate");
			var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
				pattern: "yyyy-MM-ddTHH:mm:ss"
			});
			var vDateFormatted = oDateFormat.format(oDate);
			this._controller.getView().getModel("TO").setProperty("/TO_SHIFT/SelectedShift", true);
			this._controller.getView().getModel("TO").setProperty("/TO_SHIFT/SelectedShiftDate", oEvent.getParameter("rowContext").getProperty(
				"ShiftDate"));
			this.getCurrEmpShift(vEmpId, vDateFormatted);
		},
		getCurrEmpShift: function (vEmpId, vDateFormatted) {
			var oModel = this._controller.getView().getModel();
			var oForm = sap.ui.getCore().byId("to_sf_shift");
			var sPath = oModel.createKey("/substitutionSet", {
				Empid: vEmpId,
				ShiftDate: vDateFormatted,
				Tprog: '',
				SubstTprog: '',
				SubstSubty: ''
			});
			// oForm.setModel(oModel);
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
			// var oBeguzShift = sap.ui.getCore().byId("ld_tp_beguz_shift");
			// var oEnduzShift = sap.ui.getCore().byId("ld_tp_enduz_shift");
			var oBeguzAbw = sap.ui.getCore().byId("ld_tp_beguz_leave");
			// var oBeguzBreak1 = sap.ui.getCore().byId("ld_tp_beguz_break1");
			// var oEnduzBreak1 = sap.ui.getCore().byId("ld_tp_enduz_break1");
			// var oBeguzBreak2 = sap.ui.getCore().byId("ld_tp_beguz_break2");
			// var oEnduzBreak2 = sap.ui.getCore().byId("ld_tp_enduz_break2");
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
			// var oComdate = sap.ui.getCore().byId("ld_dp_comdat");
			// var oComuzeit = sap.ui.getCore().byId("ld_tp_comuzeit");

			oPanel.setBusy(false);
			if (oPanel.getModel("UserData").getProperty("/features/TO_VTART/IsActive")) {
				// if (sap.ui.getCore().byId("to_shift_select_subtype").getVisible()) {
				this.getVtartItems();
			}

			if (oPanel.getModel("UserData").getProperty("/features/TO_VTART/IsActive")) {
				// if (oVoluntaryShift.getVisible()) {
				oVoluntaryShift.setSelected(oContext.getProperty("SubstVolSh"));
			}

			// CEPOI_EXT 12.02.2021 >>>
			/*if (oChbOwnShift.getVisible()) {
				oChbOwnShift.setSelected(oContext.getProperty("SubstOwnSh"));
			}*/
			// <<<

			if (oPanel.getModel("UserData").getProperty("/features/COMMDATE/IsActive")) {
				// if (oComdate.getVisible()) {
				if (oContext.getProperty("Comdate") !== null) {
					// oComdate.setDateValue(oContext.getProperty("Comdate"));
					// oComuzeit.setValue(oTimeFormatter.format(new Date(oContext.getProperty("Comuzeit").ms + TZOffsetMs)));
					oPanel.getModel("TO").setProperty("/TO_SHIFT/Comdate", oContext.getProperty("Comdate"));
					oPanel.getModel("TO").setProperty("/TO_SHIFT/Comuzeit", oTimeFormatter.format(new Date(oContext.getProperty("Comuzeit").ms +
						TZOffsetMs)));
				} else {
					var currentdate = new Date();
					oPanel.getModel("TO").setProperty("/TO_SHIFT/Comdate", currentdate);
					oPanel.getModel("TO").setProperty("/TO_SHIFT/Comuzeit", oTimeFormatter.format(currentdate));
				}
			}

			//Wenn NewTprog keinen Wert hat und eigene Zeiten gefüllt sind, sind individuelle Schichtzeiten hinterlegt
			if (oContext.getProperty("SubstTprog") === "****") {
				this.toggleEnabledShiftInput(true);
				oChbOwnShift.setSelected(true);
				// oBeguzShift.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstBeguz").ms + TZOffsetMs)));
				// oEnduzShift.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstEnduz").ms + TZOffsetMs)));
				// oBeguzBreak1.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstBeguzBr1").ms + TZOffsetMs)));
				// oEnduzBreak1.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstEnduzBr1").ms + TZOffsetMs)));
				// oBeguzBreak2.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstBeguzBr2").ms + TZOffsetMs)));
				// oEnduzBreak2.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstEnduzBr2").ms + TZOffsetMs)));
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
				// oBeguzShift.setEnabled(true);
				// oEnduzShift.setEnabled(true);

				// oBeguzBreak1.setEnabled(true);
				// oEnduzBreak1.setEnabled(true);
				// oBeguzBreak2.setEnabled(true);
				// oEnduzBreak2.setEnabled(true);

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
				// oBeguzShift.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstBeguz").ms + TZOffsetMs)));
				// oEnduzShift.setValue(oTimeFormatter.format(new Date(oContext.getProperty("SubstEnduz").ms + TZOffsetMs)));
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
				// oBeguzShift.setEnabled(false);
				// oEnduzShift.setEnabled(false);
				oModifyBtn.setEnabled(true);
				oChbOwnShift.setEnabled(true);
				oShiftSelect.setEnabled(true);
				oSaveBtn.setEnabled(false);
				oPanel.setBusy(false);
				//Wenn weder NewTprog gefüllt und keine eigenen Zeiten hinterlegt hat der MA keine Schichtvertretung
			} else {
				this.toggleEnabledShiftInput(false);
				// oBeguzBreak1.setValue();
				// oBeguzBreak1.setVisible(false);
				// oEnduzBreak1.setValue();
				// oEnduzBreak1.setVisible(false);
				// oBeguzBreak2.setValue();
				// oBeguzBreak2.setVisible(false);
				// oEnduzBreak2.setValue();
				// oEnduzBreak2.setVisible(false);
				oPanel.getModel("TO").setProperty("/TO_SHIFT/break1", false);
				oPanel.getModel("TO").setProperty("/TO_SHIFT/break2", false);

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
		getVtartItems: function () {
			var oDate = sap.ui.getCore().byId("ld_dp_currentDate").getDateValue();
			var sUnitKey = this._controller.getView().getModel("TO").getProperty("/UnitKey");
			var iEmpId = sap.ui.getCore().byId("ld_select_emp").getSelectedKey();
			oDate = new Date(oDate);
			oDate.setHours(12);

			var oDateFilter = new sap.ui.model.Filter("Plandate", sap.ui.model.FilterOperator.EQ, oDate);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, sUnitKey);
			var oEmpFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, iEmpId);

			var oVtartSelect = sap.ui.getCore().byId("to_shift_select_subtype");
			oVtartSelect.getBinding("items").filter([oDateFilter, oUnitFilter, oEmpFilter]);
			if (oVtartSelect.getBinding("items").isSuspended()) oVtartSelect.getBinding("items").resume();
		},
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
				if (this._controller.isFeatureEnabled("TO_INTEGOT")) {
					oOtShift.setVisible(false);
					oOtShiftLbl.setVisible(false);
				}
				var oItem = new sap.ui.core.Item({
					text: this._controller.getResourceBundleText("individuell"),
					key: "****"
				});
				var oCustomData = new sap.ui.core.CustomData({
					key: "OldShiftKey",
					writeToDom: true,
					value: oCurrentShift.getSelectedKey()
				});
				oItem.addCustomData(oCustomData);
				oShiftSelect.addItem(oItem);
				oShiftSelect.setSelectedItem(oItem);

			} else {
				if (this._controller.isFeatureEnabled("TO_INTEGOT")) {
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
					// oShiftSelect.setSelectedKey("dummy");
					oShiftSelect.clearSelection();
					oShiftSelect.setValue();
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
		setPnlShiftFieldVisibility: function (vChecked) { //TIMESOVERVIEW
			var oView = this._controller.getView();
			var oShiftSelect = sap.ui.getCore().byId("ld_select_shift");
			var oBeguzShift = sap.ui.getCore().byId("ld_tp_beguz_shift");
			var oEnduzShift = sap.ui.getCore().byId("ld_tp_enduz_shift");
			var oTprogClass = sap.ui.getCore().byId("to_shift_select_tprogclass");

			if (vChecked) {
				oShiftSelect.setEnabled(false);
				oBeguzShift.setEnabled(true);
				oEnduzShift.setEnabled(true);

				oView.getModel("TO").setProperty("/TO_SHIFT/break1", true);
				oView.getModel("TO").setProperty("/TO_SHIFT/break2", true);

				if (this._controller.isFeatureEnabled("TO_TPROGCL")) {
					oTprogClass.setVisible(true);
				}
			} else {
				oShiftSelect.setEnabled(true);
				oBeguzShift.setEnabled(false);
				oEnduzShift.setEnabled(false);

				oView.getModel("TO").setProperty("/TO_SHIFT/break1", false);
				oView.getModel("TO").setProperty("/TO_SHIFT/break2", false);

				oTprogClass.setVisible(false);
			}
		},
		onCicoEmployeeChange: function () {
			var oTable = sap.ui.getCore().byId("ld_tbl_cicooverview");
			var vDate1 = this._controller.getView().getModel("TO").getProperty("/CurrentDate");
			var vDate2 = this._controller.getView().getModel("TO").getProperty("/SecondCurrentDate");
			var oDateFilter = new sap.ui.model.Filter("Ldate", "BT", vDate1, vDate2);
			var vEmpId = this._controller.getView().getModel("TO").getProperty("/EmpId");
			var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
			var vUnitKey;
			if (this._oCicoDialog) {
				vUnitKey = Helper.getCustomDataValue(this._oCicoDialog.getAggregation("customData"), "UnitKey");
			} else {
				vUnitKey = this._controller.getView().getModel("TO").getProperty("/UnitKey");
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
		onEmployeeOvertimeSelect: function () {
			if (!this._controller.isFeatureEnabled("TO_OVERT")) return;

			this.fillOvertimeTable();

			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_overtime");
			var vEmpId = this._controller.getView().getModel("TO").getProperty("/EmpId");
			var vUnitKey = this._controller.getView().getModel("TO").getProperty("/UnitKey");
			var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var vMessageType = "OVERTIME";
			var oMsgTypeFilter = new sap.ui.model.Filter("MsgType", sap.ui.model.FilterOperator.EQ, vMessageType);

			oSubtySelect.getBinding("items").filter([oEmpIdFilter, oUnitFilter]);
			if (oSubtySelect.getBinding("items").isSuspended()) oSubtySelect.getBinding("items").resume();

			var oVerslSelect = sap.ui.getCore().byId("ld_select_versl_overtime");

			oVerslSelect.getBinding("items").filter([oEmpIdFilter, oUnitFilter]);
			if (oVerslSelect.getBinding("items").isSuspended()) oVerslSelect.getBinding("items").resume();

			var oCommentSelect = sap.ui.getCore().byId("ld_select_comment_overtime");

			var vSumKey = "";
			var oDate = sap.ui.getCore().byId("ld_dp_currentDate").getDateValue();

			oMsgTypeFilter = new sap.ui.model.Filter("MsgType", sap.ui.model.FilterOperator.EQ, vMessageType);
			var oDateFilter = new sap.ui.model.Filter("PlanDate", sap.ui.model.FilterOperator.EQ, oDate);
			oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oSumFilter = new sap.ui.model.Filter("SumKey", sap.ui.model.FilterOperator.EQ, vSumKey);

			oCommentSelect.getBinding("items").filter([oMsgTypeFilter, oDateFilter, oUnitFilter, oSumFilter]);
			if (oCommentSelect.getBinding("items").isSuspended()) oCommentSelect.getBinding("items").resume();
		},
		fillOvertimeTable: function () {
			var oTable = sap.ui.getCore().byId("ld_tbl_overtimeoverview");
			var vDate1 = this._controller.getView().getModel("TO").getProperty("/CurrentDate");
			var vDate2 = this._controller.getView().getModel("TO").getProperty("/SecondCurrentDate");
			var vEmpId = this._controller.getView().getModel("TO").getProperty("/EmpId");
			var vUnitKey = this._controller.getView().getModel("TO").getProperty("/UnitKey");
			var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
			var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "dd.MM.yyyy"
			});
			var oBegdaFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, oDateFormat.format(vDate1));
			var oEnddaFilter = new sap.ui.model.Filter("Endda", sap.ui.model.FilterOperator.EQ, oDateFormat.format(vDate2));
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

			/*oTable.getBinding('rows').filter([oEmpIdFilter, oUnitFilter, oBegdaFilter, oEnddaFilter], "Control");
			oTable.getBinding('rows').attachDataReceived(function () {
				oTable.setBusy(false);
			});
			if (oTable.getBinding('rows').isSuspended()) oTable.getBinding('rows').resume();*/
		},
		getAllowanceSet: function () {
			var oTable = sap.ui.getCore().byId("ld_tbl_allowanceOverview");
			var oAllowSelect = sap.ui.getCore().byId("ld_select_Allowance");
			var oPayGroupSelect = sap.ui.getCore().byId('ld_inp_allowancePayGroup');
			var oExtRegSelect = sap.ui.getCore().byId('ld_inp_allowanceExtReg');
			var vDate1 = this._controller.getView().getModel("TO").getProperty("/CurrentDate");
			var vDate2 = this._controller.getView().getModel("TO").getProperty("/SecondCurrentDate");
			var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "yyyyMMdd"
			});
			// var vDateFormatted = oDateFormat.format(vDateValue);
			// var oDateFilter = new sap.ui.model.Filter("ZDate", sap.ui.model.FilterOperator.EQ, vDateFormatted);
			var oDateFilter = new sap.ui.model.Filter("ZDate", "BT", oDateFormat.format(vDate1), oDateFormat.format(vDate2));
			var vEmpId = this._controller.getView().getModel("TO").getProperty("/EmpId");
			var vUnitKey = this._controller.getView().getModel("TO").getProperty("/UnitKey");
			var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
			var oUnitKeyFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);

			this._controller.getView().getModel("TO").setProperty("/TO_ALLOW/vMode", "create");

			oTable.getBinding("rows").filter([oEmpIdFilter, oDateFilter]);
			oTable.getBinding("rows").attachDataReceived(function () {
				oTable.setBusy(false);
			});
			if (oTable.getBinding("rows").isSuspended()) oTable.getBinding("rows").resume();

			oAllowSelect.getBinding("items").filter([oEmpIdFilter, oUnitKeyFilter]);
			if (oAllowSelect.getBinding("items").isSuspended()) oAllowSelect.getBinding("items").resume();

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
		getTimeTransfer: function () {
			var oTable = sap.ui.getCore().byId("ld_tbl_timetransferoverview");
			var vDate1 = this._controller.getView().getModel("TO").getProperty("/CurrentDate");
			var vDate2 = this._controller.getView().getModel("TO").getProperty("/SecondCurrentDate");
			// var oDate = sap.ui.getCore().byId("ld_dp_date");
			// var vDateValue = oDate.getDateValue();
			// if (vDateValue !== null) {
			// 	vDateValue.setHours(12);
			// }
			var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "yyyyMMdd"
			});
			// var vDateFormatted = oDateFormat.format(vDateValue);
			// var oDateFilter = new sap.ui.model.Filter("Begda", sap.ui.model.FilterOperator.EQ, vDateFormatted);
			var oDateFilter = new sap.ui.model.Filter("Begda", "BT", oDateFormat.format(vDate1), oDateFormat.format(vDate2));
			var vEmpId = this._controller.getView().getModel("TO").getProperty("/EmpId");
			var vUnitKey = this._controller.getView().getModel("TO").getProperty("/UnitKey");
			var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
			var oUnitKeyFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			// var oDateToday = new Date();
			// var oDpBegda = sap.ui.getCore().byId("ld_dp_begda_timetransfer");
			// var oDpEndda = sap.ui.getCore().byId("ld_dp_endda_timetransfer");
			var oSelectSubty = sap.ui.getCore().byId("ld_select_subty_timetransfer");

			this._controller.getView().getModel("TO").setProperty("/TO_TIMET/vMode", "create");

			// oDpBegda.setDateValue(oDateToday);
			// oDpEndda.setDateValue(oDateToday);

			// oTable.setBusy(true);
			// oTable.bindRows({
			// 	path: "/timeTransferSet",
			// 	filters: [oEmpIdFilter, oDateFilter, oUnitKeyFilter],
			// 	events: {
			// 		dataReceived: function () {
			// 			oTable.setBusy(false);
			// 		}.bind(this)
			// 	}
			// });

			oTable.getBinding("rows").filter([oEmpIdFilter, oDateFilter, oUnitKeyFilter]);
			oTable.getBinding("rows").attachDataReceived(function () {
				oTable.setBusy(false);
			});
			if (oTable.getBinding("rows").isSuspended()) oTable.getBinding("rows").resume();

			// var oTemplateShifts = new sap.ui.core.Item({
			// 	text: "{Subty} - {Text}",
			// 	key: "{Subty}"

			// });
			// oSelectSubty.bindAggregation("items", {
			// 	path: "/timeTransferSubtySet",
			// 	template: oTemplateShifts,
			// 	filters: [oEmpIdFilter, oUnitKeyFilter]
			// });

			oSelectSubty.getBinding("items").filter([oEmpIdFilter, oUnitKeyFilter]);
			if (oSelectSubty.getBinding("items").isSuspended()) oSelectSubty.getBinding("items").resume();
		},
		bindRptimeMsgTimesOverview: function () {
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oEmpFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, oEmpSelect.getSelectedKey());
			var oMessageList = sap.ui.getCore().byId("li_rp_to_msg");
			var oTemplate = sap.ui.getCore().byId("oli_rp_to_template");

			oMessageList.bindAggregation("items", {
				path: "/rptimeEmpLogSet",
				template: oTemplate,
				filters: [oEmpFilter],
				events: {
					dataReceived: function (oData) {}
				}
			});
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
		//--- MAIN CONTROL EVENTS ---//
		onCloseTimeOverviewDialogViaButton: function (oEvent) {
			var vDirty = this.onCloseTimeOverviewDialog(oEvent);
			if (vDirty) {
				Helper.openConfirmDialog("{i18n>areyousure}", vDirty, "{i18n>discard}", this.closeTimeOverviewDialog.bind(this), null,
					this._controller);
			} else {
				this._controller._oTimesOverviewDialog.close();
			}
		},
		onCloseTimeOverviewDialog: function () {
			var vErrorMsg;
			if (this.ShiftDirty || this.AbsDirty || this.OvertimeDirty || this.CicoDirty || this.AllowDirty) {
				var oResourceBundle = this._controller.getView().getModel("i18n").getResourceBundle();
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
		destroyTimeOverviewPopup: function () {
			this._controller._oTimesOverviewDialog.destroy();
			this._controller._oTimesOverviewDialog = null;
			this._controller.ShiftDirty = false;
			this._controller.AbsDirty = false;
			this._controller.OvertimeDirty = false;
			this._controller.CicoDirty = false;
			this._controller.AllowDirty = false;
		},
		onChangeTimeOverviewDate: function () {
			var oDatePicker = sap.ui.getCore().byId("ld_dp_currentDate");
			var vDate = oDatePicker.getDateValue();
			vDate.setHours(12);
			oDatePicker.setDateValue(vDate);
			oDatePicker.setValueState(sap.ui.core.ValueState.None);

			var oCalendarWeek = sap.ui.getCore().byId("inp_calendarWeek");
			var aWeekday = new Array(7);
			aWeekday[0] = this._controller.getResourceBundleText("sunday");
			aWeekday[1] = this._controller.getResourceBundleText("monday");
			aWeekday[2] = this._controller.getResourceBundleText("tuesday");
			aWeekday[3] = this._controller.getResourceBundleText("wednesday");
			aWeekday[4] = this._controller.getResourceBundleText("thursday");
			aWeekday[5] = this._controller.getResourceBundleText("friday");
			aWeekday[6] = this._controller.getResourceBundleText("saturday");

			var vWeekday = aWeekday[vDate.getDay()];

			var copiedDate = new Date(vDate.getTime());
			copiedDate.setUTCDate(copiedDate.getUTCDate() + 4 - (copiedDate.getUTCDay() || 7));
			var yearStart = new Date(Date.UTC(copiedDate.getUTCFullYear(), 0, 1));
			var vCalendarWeek = Math.ceil((((copiedDate - yearStart) / 86400000)) / 7);

			var vCalendarWeekValue = "KW " + vCalendarWeek + " - " + vWeekday;
			oCalendarWeek.setValue(vCalendarWeekValue);

			// sap.ui.getCore().byId("ld_dp_date").setDateValue(vDate);
			sap.ui.getCore().byId("ld_dp_date").setValueState(sap.ui.core.ValueState.None);
			this.clearCicoInput(); // clear CiCo
			// sap.ui.getCore().byId("ld_dp_begda_leave").setDateValue(vDate);
			// sap.ui.getCore().byId("ld_dp_endda_leave").setDateValue(vDate);
			sap.ui.getCore().byId("ld_dp_begda_leave").setValueState(sap.ui.core.ValueState.None);
			sap.ui.getCore().byId("ld_dp_endda_leave").setValueState(sap.ui.core.ValueState.None);
			// sap.ui.getCore().byId("ld_dp_begda_overtime").setDateValue(vDate);
			// sap.ui.getCore().byId("ld_dp_endda_overtime").setDateValue(vDate);
			sap.ui.getCore().byId("ld_dp_begda_overtime").setValueState(sap.ui.core.ValueState.None);
			sap.ui.getCore().byId("ld_dp_endda_overtime").setValueState(sap.ui.core.ValueState.None);
			if (sap.ui.getCore().byId("ld_select_subty_reason").getVisible()) {
				sap.ui.getCore().byId("ld_select_subty_reason").setSelectedKey("");
				sap.ui.getCore().byId("ld_inp_subty_reason").setValue("");
			}

			this.changeDatesInModel(oDatePicker.getDateValue(), oDatePicker.getSecondDateValue());

			this.getEmpShift();
			this.onCicoEmployeeChange();
			this.fillLeaveTable();
			this.fillOvertimeTable();
			this.getAllowanceSet();
			this.getTimeTransfer();
		},
		changeDatesInModel: function (oPlanBegda, oPlanEndda) {
			var oTimesModel = this._controller.getView().getModel("TO");

			oTimesModel.setProperty("/TO_CICO/ld_dp_date", oPlanBegda);

			oTimesModel.setProperty("/TO_ABS/ld_dp_begda_leave", oPlanBegda);
			oTimesModel.setProperty("/TO_ABS/ld_dp_endda_leave", oPlanEndda);

			oTimesModel.setProperty("/TO_OVERT/ld_dp_begda_overtime", oPlanBegda);
			oTimesModel.setProperty("/TO_OVERT/ld_dp_endda_overtime", oPlanEndda);

			oTimesModel.setProperty("/TO_TIMET/ld_dp_begda_timetransfer", oPlanBegda);
			oTimesModel.setProperty("/TO_TIMET/ld_dp_endda_timetransfer", oPlanEndda);

			oTimesModel.setProperty("/TO_ALLOW/dateValue", oPlanBegda);
		},
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
			this.onCicoEmployeeChange();
			this.fillLeaveTable();
			this.fillOvertimeTable();
			this.getAllowanceSet();
			this.getTimeTransfer();
		},
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
			this.onCicoEmployeeChange();
			this.fillLeaveTable();
			this.fillOvertimeTable();
			this.getAllowanceSet();
			this.getTimeTransfer();
		},
		//--- MAIN CONTROL EVENTS END ---//
		//--- ABSENCE CONTROL EVENTS ---//
		onLeaveInputChange: function (oEvent) {
			oEvent.getSource().setValueState(sap.ui.core.ValueState.None);
			this.fillLeaveTable();
		},
		onLeaveSubtyChange: function (oEvent) {
			var oBeguz = sap.ui.getCore().byId("ld_tp_beguz_leave");
			var oEnduz = sap.ui.getCore().byId("ld_tp_enduz_leave");
			var oDuration = sap.ui.getCore().byId("ld_inp_duration_leave");
			if (oEvent.getParameter("selectedItem").getKey()) {
				//TODO: change
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
				oBeguz.setModel(this._controller.getView().getModel());

				oEnduz.setVisible(true);
				if (oDuration) {
					oDuration.setVisible(true);
				}
			}
		},
		checkCommentAbsenceReason: function () {
			var oComment = sap.ui.getCore().byId("ld_select_subty_reason");
			var oCommentSelected = oComment.getSelectedItem().getBindingContext().getObject();
			var oCommentInput = sap.ui.getCore().byId("ld_inp_subty_reason");

			oCommentInput.setRequired(oCommentSelected.TextRequired);
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

				this._controller.getView().getModel().update(oContext.sPath, oRecord, {
					success: function () {
						this.updateLeaveSuccess();
						oTable.setBusy(false);
					}.bind(this),
					error: function (oError) {
						this._controller.createError(oError);
						oTable.setBusy(false);
					}.bind(this)
				});
			}
		},
		updateLeaveSuccess: function () {
			this.clearLeaveInput();
			var oResourceBundle = this._controller.getView().getModel("i18n").getResourceBundle();
			var vLeaveUpdated = oResourceBundle.getText("leaveupdated");
			this.onEmployeeSelect();
			this.AbsDirty = false;
			this.toggleEnabledButtons("leave", -1);
			MessageToast.show(vLeaveUpdated);
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
		onCancelLeaveOverview: function () {
			this.clearLeaveInput();
			this.toggleEnabledButtons("leave", -1);
			this.clearAbsPresInput();
			var oTable = sap.ui.getCore().byId("ld_tbl_leaveoverview");
			oTable.setSelectedIndex(-1);
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

				var vBegda = oEvent.getSource().getRows()[vRow].getCells()[1].getText();
				var vEndda = oEvent.getSource().getRows()[vRow].getCells()[2].getText();
				var vCBPrevDay = oEvent.getSource().getRows()[vRow].getCells()[3].getText();
				var vBeguz = oEvent.getSource().getRows()[vRow].getCells()[3].getText();
				var vEnduz = oEvent.getSource().getRows()[vRow].getCells()[4].getText();
				var vSprps = oEvent.getSource().getRows()[vRow].getCells()[5].getText();

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
				vUnitKey = Helper.getCustomDataValue(this._controller._oLeaveDialog.getAggregation("customData"), "UnitKey");
			} else {
				vUnitKey = Helper.getCustomDataValue(this._controller._oTimesOverviewDialog.getAggregation("customData"), "UnitKey");
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
					this._controller.getView().getModel().create("/absenceSet", oRecord, {
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
									this._controller);
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
				vUnitKey = Helper.getCustomDataValue(this._controller._oLeaveDialog.getAggregation("customData"), "UnitKey");
			} else {
				vUnitKey = Helper.getCustomDataValue(this._controller._oTimesOverviewDialog.getAggregation("customData"), "UnitKey");
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
					this._controller.getView().getModel().create("/absenceSet", oRecord, {
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
		},
		onCancelLeave: function () {
			var oTable = sap.ui.getCore().byId("ld_tbl_leaveoverview");
			if (oTable.getSelectedIndex() !== -1) {
				Helper.openConfirmDialog("{i18n>deleteleavesure}", "{i18n>areyousure}", "{i18n>btndeleteleave}", this._controller.cancelLeave, null,
					this._controller);
			} else {
				Helper.openNoSelectedEntryDialog("{i18n>noselectedEntry}", "{i18n>selectEntry}", null, this);
			}
		},
		createSuccess: function (oData, oResponse) {
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			var oSelectedItem = oEmpSelect.getSelectedItem();
			var vEmpId = oSelectedItem.getKey();
			var aCustomData = oSelectedItem.getCustomData();
			var vUnitKey = Helper.getCustomDataValue(aCustomData, "UnitKey");
			var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oResourceBundle = this._controller.getView().getModel("i18n").getResourceBundle();
			var vCreated = oResourceBundle.getText("leavecreated");
			this.fillLeaveTable();
			this.clearAbsPresInput();
			this.AbsDirty = false;
			MessageToast.show(vCreated);
			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_leave");
			var oAbsenceReason = sap.ui.getCore().byId("ld_select_subty_reason");
			var oCommentAbsenceReason = sap.ui.getCore().byId("ld_inp_subty_reason");
			oAbsenceReason.setSelectedKey("");
			oCommentAbsenceReason.setValue();

			oSubtySelect.getBinding("items").filter([oEmpIdFilter, oUnitFilter]);
		},
		//--- ABSENCE CONTROL EVENTS END ---//
		//--- SHIFT CONTROL ---//
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
		onTimesOverviewShiftVoluntary: function () {
			this.ShiftDirty = true;
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
		onInputChangeShift: function (oEvent) {
			this.onInputChange(oEvent);
			this.ShiftDirty = true;
		},
		onModifyShiftChangeOverview: function () {
			var oPanelShift = sap.ui.getCore().byId("pnl_shift");
			oPanelShift.setBusy(true);

			var oShiftChangeCancel = sap.ui.getCore().byId("btn_shiftChangeCancel");
			var oForm = sap.ui.getCore().byId("to_sf_shift");
			var oObject = oForm.getBindingContext().getObject();
			var oShiftSelect = sap.ui.getCore().byId("ld_select_shift");
			var oModel = this._controller.getView().getModel();
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
		onCancelShiftChangeOverview: function () { //TIMESOVERVIEW
			var oShiftChangeCancel = sap.ui.getCore().byId("btn_shiftChangeCancel");
			oShiftChangeCancel.setEnabled(false);
			var oForm = sap.ui.getCore().byId("to_sf_shift");
			var oObject = oForm.getBindingContext().getObject();
			var oModel = this._controller.getView().getModel();

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
		deleteEmpShiftSuccess: function () {
			this.clearShiftInput();
			this.getEmpShift();
			sap.ui.getCore().byId("btn_shiftChangeCancel").setEnabled(false);
			MessageToast.show(this._controller.getResourceBundleText("shiftchangedeleted"));
		},
		clearShiftInput: function () {
			var oView = this._controller.getView();
			var oOwnShiftTimes = sap.ui.getCore().byId("chb_ownShiftTimes");
			var oShiftSelect = sap.ui.getCore().byId("ld_select_shift");
			var oVoluntaryShift = sap.ui.getCore().byId("chb_voluntary");
			var oTprogClass = sap.ui.getCore().byId("to_shift_select_tprogclass");
			var oVtart = sap.ui.getCore().byId("to_shift_select_subtype");
			var oChangeButton = sap.ui.getCore().byId("btn_shiftChangeModify");

			oChangeButton.setEnabled(false);
			oOwnShiftTimes.setSelected(false);
			oShiftSelect.setEnabled(true);

			oShiftSelect.clearSelection();
			oShiftSelect.setValue();
			oView.getModel("TO").setProperty("/TO_SHIFT/break1", false);
			oView.getModel("TO").setProperty("/TO_SHIFT/break2", false);

			oVoluntaryShift.setSelected(false);
			oTprogClass.setVisible(false);
			oTprogClass.setSelectedIndex(0);
			oTprogClass.setEnabled(true);
			oVtart.setSelectedIndex(0);
		},
		onSaveShiftChangeOverview: function () { //No corrections
			var oModel = this._controller.getView().getModel();
			var oPanelShift = sap.ui.getCore().byId("pnl_shift");
			oPanelShift.setBusy(true);

			// var oShiftDate = sap.ui.getCore().byId("ld_dp_date");
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

			// var vShiftDate = oShiftDate.getDateValue();
			var vShiftDate = this._controller.getView().getModel("TO").getProperty("/TO_SHIFT/SelectedShiftDate");
			var vEmpId = oEmpSelect.getSelectedItem().getKey();
			var vDateFormatted = oDateFormat.format(vShiftDate);
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

			var vVaria = this._controller.getView().getModel().getProperty("Varia", oShiftSelect.getSelectedItem().getBindingContext());

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
				oRecord.SubstTdtype = this._controller.getView().getModel().getProperty("ShiftTdtype", oShiftSelect.getSelectedItem().getBindingContext());
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
			MessageToast.show(this._controller.getResourceBundleText("shiftchangecreated"));
		},
		//--- SHIFT CONTROL END ---//
		//--- CICO CONTROL ---//
		onCicoTimeChange: function (oEvent) {
			var oElementID = oEvent.getParameter("id");
			sap.ui.getCore().byId(oElementID).setValueState(sap.ui.core.ValueState.None);
			this.CicoDirty = true;
		},
		onInputChangeCico: function (oEvent) {
			this.onInputChange(oEvent);
			this.CicoDirty = true;
		},
		onAufnrChange: function (oEvent) {
			this.CicoDirty = true;
			var oModel = this._controller.getView().getModel();
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
		matNrSuccess: function (oData) {
			sap.ui.getCore().byId("ld_inp_aufnr").setValueState(sap.ui.core.ValueState.None);
			sap.ui.getCore().byId("ld_inp_matnr").setValue(oData.Matnr + " - " + oData.Description);
		},
		onMatnrChange: function () {
			this.CicoDirty = true;
		},
		onCicoDirty: function () {
			this.CicoDirty = true;
		},
		onSaveCico: function () {
			var oModel = this._controller.getView().getModel();
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
				vUnitKey = this._controller.getView().getModel("TO").getProperty("/UnitKey");
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
		createCicoSuccess: function () {
			this.CicoDirty = false;
			this.clearCicoInput();
			var oResourceBundle = this._controller.getView().getModel("i18n").getResourceBundle();
			var vCicoCreated = oResourceBundle.getText("cicocreated");
			MessageToast.show(vCicoCreated);
			this.toggleEnabledButtons("cico", -1);
			this.onCicoEmployeeChange();
			this.fillOvertimeTable();
		},
		onUpdateCico: function () {
			var oModel = this._controller.getView().getModel();
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
			//TODO: helper is not working
			if (this._oCicoDialog) {
				vUnitKey = Helper.getCustomDataValue(this._oCicoDialog.getAggregation("customData"), "UnitKey");
			} else {
				vUnitKey = this._controller.getView().getModel("TO").getProperty("/UnitKey");
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
		updateCicoSuccess: function () {
			var oTable = sap.ui.getCore().byId("ld_tbl_cicooverview");
			oTable.setBusy(true);
			this.CicoDirty = false;
			var oResourceBundle = this._controller.getView().getModel("i18n").getResourceBundle();
			var vCicoCreated = oResourceBundle.getText("cicoupdated");
			MessageToast.show(vCicoCreated);
			this.clearCicoInput();
			this.toggleEnabledButtons("cico", -1);
			this.onCicoEmployeeChange();
			this.fillOvertimeTable();
		},
		onDeleteCico: function () {
			var oTable = sap.ui.getCore().byId("ld_tbl_cicooverview");
			oTable.setBusy(true);
			if (oTable.getSelectedIndex() !== -1) {
				Helper.openConfirmDialog("{i18n>deletecicosure}", "{i18n>areyousure}", "{i18n>deletecico}", this.deleteCico, null, this._controller);
			} else {
				Helper.openNoSelectedEntryDialog("{i18n>noselectedEntry}", "{i18n>selectEntry}", null, this._controller);
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
			var oResourceBundle = this._controller.getView().getModel("i18n").getResourceBundle();
			var vCicoDeleted = oResourceBundle.getText("cicodeleted");
			MessageToast.show(vCicoDeleted);
			var oTable = sap.ui.getCore().byId("ld_tbl_cicooverview");
			this.onCicoEmployeeChange();
			if (oTable.getBinding("rows").getLength() == 0) {
				sap.ui.getCore().byId("ld_tp_uz").setValue();
				sap.ui.getCore().byId("chb_cico_day").setSelected(false);
				this.toggleEnabledButtons("cico", -1);
			}
			this.fillOvertimeTable();
		},
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
		onCancelCicoOverview: function () {
			this.CicoDirty = false;
			this.clearCicoInput();
		},
		clearCicoInput: function () {
			var oTime = sap.ui.getCore().byId("ld_tp_uz");
			var oCbPrev = sap.ui.getCore().byId("chb_cico_day");
			var oEventSelect = sap.ui.getCore().byId("ld_select_timeevent");
			var oTable = sap.ui.getCore().byId("ld_tbl_cicooverview");
			// oTable.setSelectedIndex(-1);
			oTable.clearSelection();
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
		handleSuggestKostenst: function (oEvent) {
			var sTerm = oEvent.getParameter("suggestValue");
			var aFilters = [];
			if (sTerm) {
				aFilters.push(new sap.ui.model.Filter("Kostenst", sap.ui.model.FilterOperator.StartsWith, sTerm));
			}
			oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
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
			// var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			// var vEmpId = oEmpSelect.getSelectedKey();
			// var oEmpIdFilter = new sap.ui.model.Filter("EmpId", sap.ui.model.FilterOperator.EQ, vEmpId);
			var oDate = sap.ui.getCore().byId("ld_dp_date");
			var vDateValue = oDate.getDateValue();
			if (vDateValue !== null) {
				vDateValue.setHours(12);
			}
			// var oDateFilter = new sap.ui.model.Filter("Datum", sap.ui.model.FilterOperator.EQ, vDateValue);
			//Ende Anpassung, unten werden noch die Filter zum Filterarray hinzugefügt

			var aFilters = [];
			if (sTerm) {
				aFilters.push(new sap.ui.model.Filter("Zulage", sap.ui.model.FilterOperator.StartsWith, sTerm));
				//Anpassung Filter hinzufügen
				// aFilters.push(oEmpIdFilter);
				// aFilters.push(oDateFilter);
				//Ende Anpassung
			}
			oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
		},
		//--- CICO CONTROL END ---//
		//--- OVERTIME CONTROL ---//
		onOvertimeInputChange: function (oEvent) {
			var oElementID = oEvent.getParameter("id");
			sap.ui.getCore().byId(oElementID).setValueState(sap.ui.core.ValueState.None);
			this.fillOvertimeTable();
		},
		onOvertimeDirty: function () {
			var oCommentSelect = sap.ui.getCore().byId("ld_select_comment_overtime");
			var oCommentInput = sap.ui.getCore().byId("ld_inp_comment_overtime");
			oCommentInput.setRequired(oCommentSelect.getSelectedKey() == 'SONST');
			this.OvertimeDirty = true;
		},
		onInputChangeOvertime: function (oEvent) {
			this.onInputChange(oEvent);
			this.OvertimeDirty = true;
		},
		checkComment: function () {
			var oComment = sap.ui.getCore().byId("ld_select_comment_overtime");
			var oCommentInput = sap.ui.getCore().byId("ld_inp_comment_overtime");
			oCommentInput.setRequired(oComment.getSelectedKey() == 'SONST');
			//	oCommentInput.setVisible(oComment.getSelectedKey() == 'SONST');
		},
		onSaveOvertime: function () {
			var oModel = this._controller.getView().getModel();
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
									oBegda.setValueStateText(this._controller.getResourceBundleText("errormsgdates"));
									oEndda.setValueState(sap.ui.core.ValueState.Error);
									oEndda.setValueStateText(this._controller.getResourceBundleText("errormsgdates"));
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
			var oResourceBundle = this._controller.getView().getModel("i18n").getResourceBundle();
			var vOvertimeCreated = oResourceBundle.getText("overtimecreated");
			this.onEmployeeOvertimeSelect();
			this.OvertimeDirty = false;
			MessageToast.show(vOvertimeCreated);
			this.clearOvertimeInput();
		},
		onUpdateOvertime: function () {
			var oModel = this._controller.getView().getModel();
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
									oBegda.setValueStateText(this._controller.getResourceBundleText("errormsgdates"));
									oEndda.setValueState(sap.ui.core.ValueState.Error);
									oEndda.setValueStateText(this._controller.getResourceBundleText("errormsgdates"));
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
		updateOvertimeSuccess: function () {
			this.clearOvertimeInput();
			this.OvertimeDirty = false;
			var oResourceBundle = this._controller.getView().getModel("i18n").getResourceBundle();
			var vOvertimeUpdated = oResourceBundle.getText("overtimeupdated");
			this.onEmployeeOvertimeSelect();
			this.toggleEnabledButtons("overtime", -1);
			MessageToast.show(vOvertimeUpdated);
		},
		onCancelOvertimeOverview: function () {
			this.clearOvertimeInput();
			this.OvertimeDirty = false;
			var oTable = sap.ui.getCore().byId("ld_tbl_overtimeoverview");
			oTable.setSelectionMode("Single");
		},
		clearOvertimeInput: function () {
			this.OvertimeDirty = false;
			var oBegda = sap.ui.getCore().byId("ld_dp_begda_overtime");
			var oEndda = sap.ui.getCore().byId("ld_dp_endda_overtime");
			if (sap.ui.getCore().byId("ld_dp_currentDate")) {
				// oBegda.setValue(sap.ui.getCore().byId("ld_dp_currentDate").getValue());
				// oEndda.setValue(sap.ui.getCore().byId("ld_dp_currentDate").getValue());
				oBegda.setDateValue(sap.ui.getCore().byId("ld_dp_currentDate").getDateValue());
				oEndda.setDateValue(sap.ui.getCore().byId("ld_dp_currentDate").getSecondDateValue());
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

			var oTable = sap.ui.getCore().byId("ld_tbl_overtimeoverview");
			oTable.clearSelection();
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
		onCancelOvertime: function (oEvent) {
			var oTable = sap.ui.getCore().byId("ld_tbl_overtimeoverview");
			if (oTable.getSelectedIndex() !== -1) {
				Helper.openConfirmDialog("{i18n>deleteovertimesure}", "{i18n>areyousure}", "{i18n>cancelovertime}", this.cancelOvertime,
					oEvent,
					this._controller);
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
			var oResourceBundle = this._controller.getView().getModel("i18n").getResourceBundle();
			var vOvertimeDeleted = oResourceBundle.getText("overtimedeleted");
			var oTable = sap.ui.getCore().byId("ld_tbl_overtimeoverview");
			this.OvertimeDirty = false;
			this.toggleEnabledButtons("overtime", -1);
			this.fillOvertimeTable();
			MessageToast.show(vOvertimeDeleted);
			oTable.setBusy(false);
		},
		//--- OVERTIME CONTROL END ---//
		//--- ALLOWANCE CONTROL ---//
		onNewAllowanceSelect: function (oEvent) {
			var oItem = oEvent.getParameter();
			var oSysModel = oEvent.getSource().getModel("AllowanceModel");

			oSysModel.setProperty("/Allowance", oItem);
			this.AllowDirty = true;
		},
		onAddAllowance: function () {
			var oModel = this._controller.getView().getModel();
			var oInpHours = sap.ui.getCore().byId("ld_inp_allowanceHours");
			var oInpAmount = sap.ui.getCore().byId("ld_inp_allowanceAmount");
			var oSelAllowance = sap.ui.getCore().byId("ld_select_Allowance");
			var oPayGroup = sap.ui.getCore().byId('ld_inp_allowancePayGroup');
			var oExtReg = sap.ui.getCore().byId('ld_inp_allowanceExtReg');
			var oTimeUnit = sap.ui.getCore().byId('ld_inp_allowanceTimeUnit');
			var oComment = sap.ui.getCore().byId('ld_inp_allowanceReason');
			var oResourceBundle = this._controller.getView().getModel("i18n").getResourceBundle();
			var oObject = {};
			var vToggleMode = "create";
			var vHours = oInpHours.getValue();
			var vAmount = oInpAmount.getValue();
			var vAllowance = oSelAllowance.getSelectedItem().getKey();
			var vEmpId = this._controller.getView().getModel("TO").getProperty("/EmpId");
			var vDate = this._controller.getView().getModel("TO").getProperty("/TO_ALLOW/dateValue");
			var vPayGroup = oPayGroup.getSelectedKey();
			var vExtReg = oExtReg.getSelectedKey();
			var vTimeUnit = oTimeUnit.getValue();
			var vComment = oComment.getValue();

			vDate = this._controller.getFormattedDate(vDate);

			if (!vHours && !vAmount) {
				oInpHours.setValueState(sap.ui.core.ValueState.Error);
				oInpAmount.setValueState(sap.ui.core.ValueState.Error);
			} else {
				oInpHours.setValueState(sap.ui.core.ValueState.None);
				oInpAmount.setValueState(sap.ui.core.ValueState.None);

				oObject.EmpId = vEmpId;
				oObject.ZDate = vDate;
				oObject.Zulage = vAllowance;
				oObject.ZHours = vHours ? parseFloat(vHours).toFixed(7) : "0.00";
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
		toggleAllowanceButtons: function (vMode) {
			var oModel = this._controller.getView().getModel("TO");
			var oShiftSelect = sap.ui.getCore().byId("ld_select_Allowance");
			var oInpHours = sap.ui.getCore().byId("ld_inp_allowanceHours");
			var oInpAmount = sap.ui.getCore().byId("ld_inp_allowanceAmount");
			var oTableAllowance = sap.ui.getCore().byId("ld_tbl_allowanceOverview");
			var oTimeUnit = sap.ui.getCore().byId('ld_inp_allowanceTimeUnit');
			var oComment = sap.ui.getCore().byId('ld_inp_allowanceReason');

			oModel.setProperty("/TO_ALLOW/vMode", vMode);

			if (vMode == "create") {
				oShiftSelect.setSelectedKey(0);
				oInpHours.setValue();
				oInpAmount.setValue();
				oTableAllowance.setSelectionMode("Single");
				oTimeUnit.setValue();
				oComment.setValue();
			}
		},
		onUpdateAllowance: function () {
			var oModel = this._controller.getView().getModel();
			var oInpHours = sap.ui.getCore().byId("ld_inp_allowanceHours");
			var oInpAmount = sap.ui.getCore().byId("ld_inp_allowanceAmount");
			var oSelAllowance = sap.ui.getCore().byId("ld_select_Allowance");
			// var oDate = sap.ui.getCore().byId("ld_dp_date");
			var oTable = sap.ui.getCore().byId("ld_tbl_allowanceOverview");
			var oPayGroup = sap.ui.getCore().byId('ld_inp_allowancePayGroup');
			var oExtReg = sap.ui.getCore().byId('ld_inp_allowanceExtReg');
			var oTimeUnit = sap.ui.getCore().byId('ld_inp_allowanceTimeUnit');
			var oComment = sap.ui.getCore().byId('ld_inp_allowanceReason');

			var oResourceBundle = this._controller.getView().getModel("i18n").getResourceBundle();
			var oObject = {};

			var vToggleMode = "create";
			var vHours = oInpHours.getValue();
			var vAmount = oInpAmount.getValue();
			var vAllowance = oSelAllowance.getSelectedItem().getKey();
			var vEmpId = this._controller.getView().getModel("TO").getProperty("/EmpId");
			var oContext = oTable.getContextByIndex(oTable.getSelectedIndex());
			var vPayGroup = oPayGroup.getSelectedKey();
			var vExtReg = oExtReg.getSelectedKey();
			var vTimeUnit = oTimeUnit.getValue();
			var vComment = oComment.getValue();

			// vDate = this._controller.getFormattedDate(vDate);
			var vDate = this._controller.getFormattedDate(this._controller.getView().getModel("TO").getProperty("/TO_ALLOW/dateValue"));

			if (!vHours && !vAmount) {
				oInpHours.setValueState(sap.ui.core.ValueState.Error);
				oInpAmount.setValueState(sap.ui.core.ValueState.Error);

			} else {
				oInpHours.setValueState(sap.ui.core.ValueState.None);
				oInpAmount.setValueState(sap.ui.core.ValueState.None);

				oObject.EmpId = vEmpId;
				oObject.ZDate = vDate;
				oObject.Zulage = vAllowance;
				oObject.ZHours = vHours ? parseFloat(vHours).toFixed(7) : "0.00";
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
		onCancelAllowance: function () {
			this.toggleAllowanceButtons("create");
		},
		onAllowanceEntrySelect: function (oEvent) {
			if (oEvent.getSource().getSelectedIndex() == -1) {
				return;
			}
			var oShiftSelect = sap.ui.getCore().byId("ld_select_Allowance");
			var oInpHours = sap.ui.getCore().byId("ld_inp_allowanceHours");
			var oInpAmount = sap.ui.getCore().byId("ld_inp_allowanceAmount");
			var vBindingContext = oEvent.getSource().getContextByIndex(oEvent.getSource().getSelectedIndex());

			var oPayGroup = sap.ui.getCore().byId('ld_inp_allowancePayGroup');
			var oExtReg = sap.ui.getCore().byId('ld_inp_allowanceExtReg');
			var oTimeUnit = sap.ui.getCore().byId('ld_inp_allowanceTimeUnit');
			var oComment = sap.ui.getCore().byId('ld_inp_allowanceReason');

			oShiftSelect.setSelectedKey(oEvent.getSource().getModel().getProperty("Zulage", vBindingContext));
			oInpHours.setValue(oEvent.getSource().getModel().getProperty("ZHours", vBindingContext));
			oInpAmount.setValue(oEvent.getSource().getModel().getProperty("ZAmount", vBindingContext));

			oTimeUnit.setValue(oEvent.getSource().getModel().getProperty("ZZeinh", vBindingContext));
			oPayGroup.setSelectedKey(oEvent.getSource().getModel().getProperty("ZTrfgr", vBindingContext));
			oExtReg.setSelectedKey(oEvent.getSource().getModel().getProperty("ZExbel", vBindingContext));
			oComment.setSelectedKey(oEvent.getSource().getModel().getProperty("ZComment", vBindingContext));

			this.toggleAllowanceButtons("edit");
		},
		onDeleteAllowance: function () {
			var oModel = this._controller.getView().getModel();
			var oTable = sap.ui.getCore().byId("ld_tbl_allowanceOverview");
			var oResourceBundle = this._controller.getView().getModel("i18n").getResourceBundle();
			var oContext = oTable.getContextByIndex(oTable.getSelectedIndex());
			oModel.remove(oContext.sPath, {
				success: function () {
					var vDeleted = oResourceBundle.getText("allowancedeleted");
					MessageToast.show(vDeleted);
					this.getAllowanceSet();
				}.bind(this),
				error: this.createError.bind(this)
			});

			this.toggleAllowanceButtons("create");

			this.AllowDirty = false;
		},
		//--- ALLOWANCE CONTROL END ---//
		//--- TIME TRANSFER CONTROL ---//
		onTimeTransferInputChange: function () {
			this.TimeDirty = true;
		},
		onCreateTimeTransfer: function () {
			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_timetransfer");
			var oBegdaPicker = sap.ui.getCore().byId("ld_dp_begda_timetransfer");
			var oEnddaPicker = sap.ui.getCore().byId("ld_dp_endda_timetransfer");
			var oModel = this._controller.getView().getModel();

			var oResourceBundle = this._controller.getView().getModel("i18n").getResourceBundle();
			var oInpAmount = sap.ui.getCore().byId("ld_inp_amount_timetransfer");
			var oObject = {};

			var vToggleMode = "create";
			var vAmount = oInpAmount.getValue();
			var vSubty = oSubtySelect.getSelectedItem().getKey();
			var vEmpId = this._controller.getView().getModel("TO").getProperty("/EmpId");
			var vBegda = oBegdaPicker.getDateValue();
			var vEndda = oEnddaPicker.getDateValue();

			if (!vBegda) {
				oBegdaPicker.setValueState(sap.ui.core.ValueState.Error);
			} else if (!vEndda) {
				oEnddaPicker.setValueState(sap.ui.core.ValueState.Error);
			} else if (!vAmount) {
				oInpAmount.setValueState(sap.ui.core.ValueState.Error);
			} else {
				vBegda = this._controller.getFormattedDate(vBegda);
				vEndda = this._controller.getFormattedDate(vEndda);
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
		onUpdateTimeTransfer: function () {
			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_timetransfer");
			var oInpAmount = sap.ui.getCore().byId("ld_inp_amount_timetransfer");
			var oBegdaPicker = sap.ui.getCore().byId("ld_dp_begda_timetransfer");
			var oEnddaPicker = sap.ui.getCore().byId("ld_dp_endda_timetransfer");
			var oTable = sap.ui.getCore().byId("ld_tbl_timetransferoverview");
			var oModel = this._controller.getView().getModel();
			var oResourceBundle = this._controller.getView().getModel("i18n").getResourceBundle();
			var oObject = {};

			var vToggleMode = "create";
			var vAmount = oInpAmount.getValue();
			var vBegda = oBegdaPicker.getDateValue();
			var vEndda = oEnddaPicker.getDateValue();
			var vSubty = oSubtySelect.getSelectedItem().getKey();
			var vEmpId = this._controller.getView().getModel("TO").getProperty("/EmpId");
			var oContext = oTable.getContextByIndex(oTable.getSelectedIndex());

			if (!vBegda) {
				oBegdaPicker.setValueState(sap.ui.core.ValueState.Error);
			} else if (!vEndda) {
				oEnddaPicker.setValueState(sap.ui.core.ValueState.Error);
			} else if (!vAmount) {
				oInpAmount.setValueState(sap.ui.core.ValueState.Error);
			} else {
				vBegda = this._controller.getFormattedDate(vBegda);
				vEndda = this._controller.getFormattedDate(vEndda);
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
		onDeleteTimeTransfer: function () {
			var oTable = sap.ui.getCore().byId("ld_tbl_timetransferoverview");
			var oModel = this._controller.getView().getModel();
			var oResourceBundle = this._controller.getView().getModel("i18n").getResourceBundle();
			var vToggleMode = "create";

			var oContext = oTable.getContextByIndex(oTable.getSelectedIndex());
			oModel.remove(oContext.sPath, {
				success: function () {
					var vDeleted = oResourceBundle.getText("timetransferdeleted");
					MessageToast.show(vDeleted);
					this.getTimeTransfer();
				}.bind(this),
				error: this.createError.bind(this)
			});

			this.toggleTimeTransferButtons(vToggleMode);

			this.TimeDirty = false;
		},
		toggleTimeTransferButtons: function (vMode) {
			var oDate = new Date();
			var oSubtySelect = sap.ui.getCore().byId("ld_select_subty_timetransfer");
			var oInpAmount = sap.ui.getCore().byId("ld_inp_amount_timetransfer");
			var oDpBegda = sap.ui.getCore().byId("ld_dp_begda_timetransfer");
			var oDpEndda = sap.ui.getCore().byId("ld_dp_endda_timetransfer");

			var oTable = sap.ui.getCore().byId("ld_tbl_timetransferoverview");

			oTable.getModel("TO").setProperty("/TO_TIMET/vMode", vMode);

			if (vMode === "create") {
				oSubtySelect.setSelectedKey(0);

				oDpBegda.setDateValue(oDate);
				oDpEndda.setDateValue(oDate);

				oInpAmount.setValue();
			}
		},
		onCancelTimeTransfer: function () {
			var oTable = sap.ui.getCore().byId("ld_tbl_timetransferoverview");

			oTable.clearSelection();
			this.toggleTimeTransferButtons("create");
		},
		//--- TIME TRANSFER CONTROL END ---//
		//--- TIME REPORT CONTROL ---//
		onStartRptimeTimesOverview: function () {
			var oModel = this._controller.getView().getModel();
			//get emp from emp select
			var oEmpSelect = sap.ui.getCore().byId("ld_select_emp");
			oEmpSelect.setValueState(sap.ui.core.ValueState.None);
			var vEmpid = this._controller.getView().getModel("TO").getProperty("/EmpId");
			//get unitkey from custom data
			// var vUnitKey = Helper.getCustomDataValue(oEmpSelect.getSelectedItem().getAggregation("customData"), "UnitKey");
			var vUnitKey = oEmpSelect.getSelectedItem().getBindingContext().getProperty("UnitKey");
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

					this._controller._oRptime.clearBuffer(vUnitKey);
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
		getRptimeDataInInterval: function (vUnitKey, oEvent) {
			var oRptimeLogButton = sap.ui.getCore().byId("btn_rptimemsg_" + vUnitKey);

			this._controller._oRptime.refreshBuffer(vUnitKey, oRptimeLogButton).then(function (oResult) {
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
						MessageBox.information(this._controller.getResourceBundleText("rptimesuccess"));
					} else {
						oResult.oTemplate.setType(sap.m.ButtonType.Unstyled);
						oResult.oTemplate.setText("");
					}
				}
			}.bind(this));
		},
		onClickRptimeMsg: function (oEvent) {
			var oModel = this._controller.getView().getModel();
			if (sap.ui.getCore().byId("ld_select_attention")) {
				sap.ui.getCore().byId("ld_select_attention").destroy();
			}

			if (sap.ui.getCore().byId("ta_attent_explain")) {
				sap.ui.getCore().byId("ta_attent_explain").destroy();
			}

			var oResourceBundle = this._controller.getView().getModel("i18n").getResourceBundle();
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
			this._controller.getView().addDependent(oPopover);

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
			// var vUnitKey = Helper.getCustomDataValue(oEmpSelect.getSelectedItem().getAggregation("customData"), "UnitKey");
			var vUnitKey = oEmpSelect.getSelectedItem().getBindingContext().getProperty("UnitKey");
			var vSumKey = "Unwichtig";
			var vNoteKey = "Unwichtig2";

			var oMsgTypeFilter = new sap.ui.model.Filter("MsgType", sap.ui.model.FilterOperator.EQ, vMessageType);
			var oDateFilter = new sap.ui.model.Filter("PlanDate", sap.ui.model.FilterOperator.EQ, oBegda);
			var oUnitFilter = new sap.ui.model.Filter("UnitKey", sap.ui.model.FilterOperator.EQ, vUnitKey);
			var oSumFilter = new sap.ui.model.Filter("SumKey", sap.ui.model.FilterOperator.EQ, vSumKey);

			var oMessageComplete = {};
			oMessageComplete.Begda = oBegda;
			oMessageComplete.Endda = oEndda;
			// oMessageComplete.EmpId = oEmpSelect.getSelectedKey();
			oMessageComplete.EmpId = this._controller.getView().getModel("TO").getProperty("/EmpId");
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
		onMsgCompletionButtonClick: function (oMsgCompletion, oPopover, vUnitKey) {
			var oModel = this._controller.getView().getModel();
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
			var oResourceBundle = this._controller.getView().getModel("i18n").getResourceBundle();
			var vCreated = oResourceBundle.getText("attentionNoteCreated");
			MessageToast.show(vCreated);
		},
		//--- TIME REPORT CONTROL END ---//
		//--- COMMON FUNCTIONS ---//
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
		onInputChange: function (oEvent) {
			var oElementID = oEvent.getParameter("id");
			sap.ui.getCore().byId(oElementID).setValueState(sap.ui.core.ValueState.None);
		},
		createError: function (oError) {
			var aErrorMsg = JSON.parse(oError.responseText).error.innererror.errordetails;
			// var oMessageModel = sap.ui.getCore().getMessageManager().getMessageModel();
			// MessageBox.error(oMessageModel.getData()[1].message);
			MessageBox.error(aErrorMsg[0].message);
		},
		tableBooleanText: function (vBoolean) {
			var oResourceBundle = this._controller.getView().getModel("i18n").getResourceBundle();
			switch (vBoolean) {
			case true:
				return oResourceBundle.getText("booltrue");
			case false:
				return oResourceBundle.getText("boolfalse");
			default:
				return vBoolean;
			}
		},

		closeTimeOverviewDialog: function () {
			this._controller._oTimesOverviewDialog.close();
		}
	};
});