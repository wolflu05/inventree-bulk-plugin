export const templateTypeOptions = {
  PART_CATEGORY: "Part Category",
  STOCK_LOCATION: "Stock Location",
}

export const getGenerateKeysForTemplate = async () => {
  const res = await fetch("/plugin/inventree-bulk-plugin/parse", {
    method: "OPTIONS",
  });
  return await res.json();
}

export const getGenerateKeysForTemplateType = async (type) => {
  const keys = await getGenerateKeysForTemplate();
  return keys[type];
}
