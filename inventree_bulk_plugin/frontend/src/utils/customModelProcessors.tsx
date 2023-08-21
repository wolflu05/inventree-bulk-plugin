/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */

// define custom processors for models that does not really exist or have no model renderer
interface CustomModelProcessor {
  render: (item: any) => string;
  mapFunction: (item: any) => any;
  getSingle?: (id: any, success: (data: any) => void) => void;
}
export const customModelProcessors: Record<string, CustomModelProcessor> = {
  "_part.part_image": {
    // @ts-ignore
    render: (item) => {
      if (!item.pk && !item.id) return "";
      // @ts-ignore
      return renderModel({
        // @ts-ignore
        image: item.image ? `/media/${item.image}` : blankImage(),
        text: item.image || `Not found: ${item.id}`,
      });
    },
    mapFunction: (item) => ({ ...item, id: item.image || item.id }),
    getSingle: (id, success) => {
      // @ts-ignore
      inventreeGet(
        `/api/part/thumbs/`,
        {},
        {
          success: (data: any) => {
            success(data.find((x: any) => x.image === id) || { image: "", id });
          },
        },
      );
    },
  },
};
