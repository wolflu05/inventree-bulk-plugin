export const renderPanel = (ref, args) => {
    let unmountHandler;
    const run = async () => {
        await import("http://localhost:5210/@vite/client");
        const { renderPanel } = await import("http://localhost:5210/src/pages/bulk-creation-panel.tsx");
        unmountHandler = renderPanel(ref, args);
    };
    run();

    return () => {
        unmountHandler?.();
    }
};
