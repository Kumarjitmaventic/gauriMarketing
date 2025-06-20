/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"marketingcampaignreq/zcrmktmarketingcampaign/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});
