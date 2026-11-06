// Node module hooks: redirect `cloudflare:sockets` to the local test stub.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:sockets") {
    return {
      url: new URL("./cloudflare-sockets-stub.mjs", import.meta.url).href,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
