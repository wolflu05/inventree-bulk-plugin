const templateTypeOptions = {
  PART_CATEGORY: "Part Category",
  STOCK_LOCATION: "Stock Location",
}

const getGenerateKeysForTemplate = async () => {
  const res = await fetch("{% url 'plugin:inventree-bulk-plugin:parse' %}", {
    method: "OPTIONS",
  });
  return await res.json();
}

const getGenerateKeysForTemplateType = async (type) => {
  const keys = await getGenerateKeysForTemplate();
  return keys[type];
}
