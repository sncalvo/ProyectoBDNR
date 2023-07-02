import { UserButton } from "@clerk/nextjs";
import Head from "next/head";
import { ReactNode } from "react";

import { SignedIn, SignedOut } from "@clerk/nextjs";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "~/components/navigation-menu"
import Link from "next/link";

const Header = () => (
  <>
    <Head>
      <title>Mis Previas</title>
      <link rel="icon" href="/favicon.ico" />
    </Head>
    <header>
      <div className="w-100 flex justify-between items-center p-5">
        <h1 className="cursor-pointer text-[2rem] font-extrabold tracking-tight text-accent">
          Mis Previas
        </h1>
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <Link href="/" legacyBehavior passHref>
                <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                  Todas
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href="/available" legacyBehavior passHref>
                <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                  Disponibles
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href="/recommended" legacyBehavior passHref>
                <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                  Recomendado
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
          </NavigationMenuList>

          <div className="ml-5">
            <UserButton />
          </div>
        </NavigationMenu>
      </div>
    </header>
  </>
);

const Footer = () => (
  <></>
);

const Layout = ({ children }: { children: ReactNode }) => (
  <>
    <SignedIn>
      <Header />
      <main className="flex flex-col items-center justify-center">
        {children}
      </main>
      <Footer />
    </SignedIn>
    <SignedOut>
      {children}
    </SignedOut>
  </>
);

export { Layout };
