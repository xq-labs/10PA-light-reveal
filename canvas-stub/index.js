// No-op stub for the native `canvas` package.
//
// MindAR declares `canvas` as a dependency because its OFFLINE image compiler
// (Node.js) uses it. This app only ships MindAR's browser runtime bundle
// (`mindar-image-three.prod.js`), imported from a client-only (`ssr: false`)
// component, so `canvas` is never actually required at build or runtime.
//
// Stubbing it here avoids a fragile native (node-gyp / cairo / pixman) build.
// If you ever need MindAR's Node-side compiler, remove the `canvas` override
// in package.json and install the real `canvas` package instead.
module.exports = new Proxy(
  {},
  {
    get() {
      throw new Error(
        "The `canvas` package is stubbed out in this project (see canvas-stub/). " +
          "It is not needed for the browser AR runtime."
      );
    },
  }
);
