sap.ui.define([
	"sap/ui/table/Table"
], function(Table) {
	"use strict";

	return Table.extend("MIND2PEP_PLANNER.controls.customTable", {
		metadata : {
			properties : {
				customerRowCount: {type : "int", defaultValue : 1}
			}
		},
		renderer: {
			renderTable : function (rm, oTable) {
				rm.write("<div");
				var iLines = oTable.getCustomerRowCount() || 5,
					sHeight = (oTable.getRowHeight() + 1) * iLines + 1;
				rm.writeAttribute("style", "width: 100%; height: " + sHeight + "px; overflow: auto;");
				rm.write(">");
				
				this.renderTabElement(rm, "sapUiTableCtrlBefore");
				rm.write("<div");
				rm.writeAttribute("id", oTable.getId() + "-tableCCnt");
				rm.addClass("sapUiTableCCnt");
				rm.writeClasses();
				rm.write(">");
			
				this.renderTableCCnt(rm, oTable);
				rm.write("</div>");
				rm.write("</div>");
				this.renderTabElement(rm, "sapUiTableCtrlAfter");
				this.renderVSb(rm, oTable);
				this.renderHSb(rm, oTable);
			}
		}
	});
});