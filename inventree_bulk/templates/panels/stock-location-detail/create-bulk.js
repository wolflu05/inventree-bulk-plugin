{% include "components/generateBulkCreateView.js" %}

generateBulkCreateView({
  target: document.getElementById("bulk-create-location-preact-root"),
  generateKeys: ["name", "description"],
  createURL: "{% url 'plugin:bulkaction:bulkcreatelocation' pk=location.id %}",
  name: "locations",
  defaultSchema: null,
  tableSelector: "#bulk-create-location-preview-table"
});
