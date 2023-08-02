const templateTypeOptions = {
  PART_CATEGORY: "Part Category",
  STOCK_LOCATION: "Stock Location",
}

const generateKeysForTemplateType = {
  PART_CATEGORY: {
    name: { name: "Name", required: true },
    description: { name: "Description" }
  },
  STOCK_LOCATION: {
    name: { name: "Name", required: true },
    description: { name: "Description" }
  },
}
