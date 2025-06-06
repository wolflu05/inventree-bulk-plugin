/**
 * Component for loading an image from the InvenTree server
 *
 * Image caching is handled automatically by the browsers cache
 */
import { Image, type ImageProps, Skeleton, Stack } from "@mantine/core";
import { useMemo } from "react";

import { useInvenTreeContext } from "../../contexts/InvenTreeContext";

/**
 * Returns the edit view URL for a given model type
 */
export function generateUrl(url: string | URL, base: string): string {
  let newUrl: string | URL = url;

  try {
    if (base) {
      newUrl = new URL(url, base).toString();
    } else {
      newUrl = url.toString();
    }
  } catch {
    console.error(`ERR: generateURL failed. url='${url}', base='${base}'`);
  }

  return newUrl.toString();
}

interface ApiImageProps extends ImageProps {
  onClick?: (event: unknown) => void;
}

/**
 * Construct an image container which will load and display the image
 */
export function ApiImage(props: Readonly<ApiImageProps>) {
  const { host } = useInvenTreeContext();

  const imageUrl = useMemo(() => {
    return generateUrl(props.src, host);
  }, [host, props.src]);

  return (
    <Stack>
      {imageUrl ? (
        <Image {...props} src={imageUrl} fit="contain" />
      ) : (
        <Skeleton h={props?.h ?? props.w} w={props?.w ?? props.h} />
      )}
    </Stack>
  );
}
