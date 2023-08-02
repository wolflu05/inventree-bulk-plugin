{% include "components/generateBulkCreateView.js" %}

generateBulkCreateView({
  target: document.getElementById("bulk-create-location-preact-root"),
  createURL: "{% url 'plugin:inventree-bulk-plugin:bulkcreatelocation' pk=location.id %}",
  name: "locations",
  defaultSchema: null,
  tableSelector: "#bulk-create-location-preview-table",
  templateType: "STOCK_LOCATION",
});
