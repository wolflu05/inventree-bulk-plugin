{% include "components/generateBulkCreateView.js" %}

generateBulkCreateView({
  target: document.getElementById("bulk-create-category-preact-root"),
  generateKeys: ["name", "description"],
  createURL: "{% url 'plugin:bulkaction:bulkcreatecategory' pk=category.id %}",
  name: "categories",
  defaultSchema: null,
  tableSelector: "#bulk-create-category-preview-table"
});
