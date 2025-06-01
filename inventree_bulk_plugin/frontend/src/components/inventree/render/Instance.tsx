import { type ReactElement, ReactNode, useCallback } from "preact/compat";

import { ModelType, navigateToLink } from "@inventreedb/ui";
import { Alert, Anchor, Group, Skeleton, Space, Text } from "@mantine/core";

import { RenderBuildItem, RenderBuildLine, RenderBuildOrder } from "./Build";
import { RenderAddress, RenderCompany, RenderContact, RenderManufacturerPart, RenderSupplierPart } from "./Company";
import { RenderContentType, RenderError, RenderImportSession, RenderProjectCode, RenderSelectionList } from "./Generic";
import {
  RenderPurchaseOrder,
  RenderReturnOrder,
  RenderReturnOrderLineItem,
  RenderSalesOrder,
  RenderSalesOrderShipment,
} from "./Order";
import {
  RenderPart,
  RenderPartCategory,
  RenderPartImage,
  RenderPartParameterTemplate,
  RenderPartTestTemplate,
} from "./Part";
import { RenderPlugin } from "./Plugin";
import { RenderLabelTemplate, RenderReportTemplate } from "./Report";
import { RenderStockItem, RenderStockLocation, RenderStockLocationType } from "./Stock";
import { RenderGroup, RenderOwner, RenderUser } from "./User";
import { Thumbnail } from "../Thumbnail";

/**
 * Reduce an input string to a given length, adding an ellipsis if necessary
 * @param str - String to shorten
 * @param len - Length to shorten to
 */
export function shortenString({ str, len = 100 }: { str: string | undefined; len?: number }) {
  // Ensure that the string is a string
  str = str ?? "";
  str = str.toString();

  // If the string is already short enough, return it
  if (str.length <= len) {
    return str;
  }

  // Otherwise, shorten it
  const N = Math.floor(len / 2 - 1);

  return `${str.slice(0, N)} ... ${str.slice(-N)}`;
}

type EnumDictionary<T extends string | symbol | number, U> = {
  [K in T]: U;
};

export interface InstanceRenderInterface {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: any;
  link?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigate?: any;
  showSecondary?: boolean;
}

/**
 * Lookup table for rendering a model instance
 */
const RendererLookup: EnumDictionary<
  ModelType | "part_image",
  (props: Readonly<InstanceRenderInterface>) => ReactElement
> = {
  [ModelType.address]: RenderAddress,
  [ModelType.build]: RenderBuildOrder,
  [ModelType.buildline]: RenderBuildLine,
  [ModelType.builditem]: RenderBuildItem,
  [ModelType.company]: RenderCompany,
  [ModelType.contact]: RenderContact,
  [ModelType.manufacturerpart]: RenderManufacturerPart,
  [ModelType.owner]: RenderOwner,
  [ModelType.part]: RenderPart,
  [ModelType.partcategory]: RenderPartCategory,
  [ModelType.partparametertemplate]: RenderPartParameterTemplate,
  [ModelType.parttesttemplate]: RenderPartTestTemplate,
  [ModelType.projectcode]: RenderProjectCode,
  [ModelType.purchaseorder]: RenderPurchaseOrder,
  [ModelType.purchaseorderlineitem]: RenderPurchaseOrder,
  [ModelType.returnorder]: RenderReturnOrder,
  [ModelType.returnorderlineitem]: RenderReturnOrderLineItem,
  [ModelType.salesorder]: RenderSalesOrder,
  [ModelType.salesordershipment]: RenderSalesOrderShipment,
  [ModelType.stocklocation]: RenderStockLocation,
  [ModelType.stocklocationtype]: RenderStockLocationType,
  [ModelType.stockitem]: RenderStockItem,
  [ModelType.stockhistory]: RenderStockItem,
  [ModelType.supplierpart]: RenderSupplierPart,
  [ModelType.user]: RenderUser,
  [ModelType.group]: RenderGroup,
  [ModelType.importsession]: RenderImportSession,
  [ModelType.reporttemplate]: RenderReportTemplate,
  [ModelType.labeltemplate]: RenderLabelTemplate,
  [ModelType.pluginconfig]: RenderPlugin,
  [ModelType.contenttype]: RenderContentType,
  [ModelType.selectionlist]: RenderSelectionList,
  [ModelType.error]: RenderError,
  part_image: RenderPartImage,
};

export type RenderInstanceProps = {
  model: ModelType | undefined;
} & InstanceRenderInterface;

/**
 * Render an instance of a database model, depending on the provided data
 */
export function RenderInstance(props: RenderInstanceProps): ReactElement {
  if (props.model === undefined) {
    return <UnknownRenderer model={props.model} />;
  }

  const model_name = props.model.toString().toLowerCase() as ModelType;

  const RenderComponent = RendererLookup[model_name];

  if (!RenderComponent) {
    return <UnknownRenderer model={props.model} />;
  }

  return <RenderComponent {...props} />;
}

export function RenderRemoteInstance({
  model,
  pk,
}: Readonly<{
  model: ModelType;
  pk: number;
}>): ReactElement {
  // TODO
  // const api = useApi();
  const isLoading = false; // Replace with actual loading state
  const isFetching = false; // Replace with actual fetching state
  const data = null; // Replace with actual data fetching logic

  // const { data, isLoading, isFetching } = useQuery({
  //   queryKey: ["model", model, pk],
  //   queryFn: async () => {
  //     const url = "";
  //     // const url = apiUrl(ModelInformationDict[model].api_endpoint, pk);

  //     return api
  //       .get(url)
  //       .then((response) => response.data)
  //       .catch(() => null);
  //   },
  // });

  if (isLoading || isFetching) {
    return <Skeleton />;
  }

  if (!data) {
    return (
      <Text>
        {model}: {pk}
      </Text>
    );
  }

  return <RenderInstance model={model} instance={data} />;
}

/**
 * Helper function for rendering an inline model in a consistent style
 */
export function RenderInlineModel({
  primary,
  secondary,
  prefix,
  suffix,
  image,
  url,
  navigate,
  showSecondary = true,
  tooltip,
}: Readonly<{
  primary: string;
  secondary?: string;
  showSecondary?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  image?: string;
  labels?: string[];
  url?: string;
  navigate?: () => void;
  tooltip?: string;
}>): ReactElement {
  const onClick = useCallback(
    (event: unknown) => {
      if (url && navigate) {
        navigateToLink(url, navigate, event);
      }
    },
    [url, navigate],
  );

  const primaryText = shortenString({
    str: primary,
    len: 50,
  });

  const secondaryText = shortenString({
    str: secondary,
    len: 75,
  });

  return (
    <Group gap="xs" justify="space-between" wrap="nowrap" title={tooltip}>
      <Group gap="xs" justify="left" wrap="nowrap">
        {prefix}
        {image && <Thumbnail src={image} size={18} />}
        {url ? (
          <Anchor href="" onClick={(event: unknown) => onClick(event)}>
            <Text size="sm">{primaryText}</Text>
          </Anchor>
        ) : (
          <Text size="sm">{primaryText}</Text>
        )}
        {showSecondary && secondary && <Text size="xs">{secondaryText}</Text>}
      </Group>
      {suffix && (
        <>
          <Space />
          <div style={{ fontSize: "xs", lineHeight: "xs" }}>{suffix}</div>
        </>
      )}
    </Group>
  );
}

export function UnknownRenderer({
  model,
}: Readonly<{
  model: ModelType | undefined;
}>): ReactElement {
  const model_name = model ? model.toString() : "undefined";
  return <Alert color="red" title={`Unknown model: ${model_name}`} />;
}
