{% include "components/generateBulkCreateView.js" %}

generateBulkCreateView({
  target: document.getElementById("bulk-create-category-preact-root"),
  createURL: "{% url 'plugin:inventree-bulk-plugin:bulkcreatecategory' pk=category.id %}",
  name: "categories",
  defaultSchema: null,
  tableSelector: "#bulk-create-category-preview-table",
  templateType: "PART_CATEGORY",
});
