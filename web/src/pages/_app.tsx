import { ClerkProvider } from "@clerk/nextjs";
import type { AppType } from "next/app";
import { api } from "~/utils/api";
import "~/styles/globals.css";
import { Layout } from "~/components/Layout";

const MyApp: AppType = ({ Component, pageProps }) => 
  <ClerkProvider {...pageProps}>
    <Layout>
      <Component {...pageProps} />
    </Layout>
  </ClerkProvider>

export default api.withTRPC(MyApp);
