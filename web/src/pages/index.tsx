import { type NextPage } from "next";
import Head from "next/head";
import { ColumnDef } from "@tanstack/react-table";
import { api, type RouterOutputs } from "~/utils/api";
import { UserButton } from "@clerk/nextjs";
import { DataTable } from "~/components/molecules/DataTable";

type Subject = RouterOutputs["subjects"]["all"][number]

const subjectColumns: ColumnDef<Subject>[] = [
    {
      accessorKey: "code",
      header: "Code"
    },
    {
      accessorKey: "name",
      header: "Name"
    },
    {
      accessorKey: "credits",
      header: "Credits"
    },
  ]


const Home: NextPage = () => {
  const subjects = api.subjects.all.useQuery();

  return (
    <>
      <Head>
        <title>Mis Previas</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <header>
        <div className="w-100 flex justify-between items-center p-5">
          <h1 className="text-2xl font-bold tracking-tight text-black">
            Mis Previas
          </h1>
          <UserButton />
        </div>
      </header>
      <main className="flex min-h-screen flex-col items-center justify-center">
        <div className="container flex flex-col items-center justify-center px-4 py-16 ">
          {
            subjects.data
              ? <DataTable data={subjects.data} columns={subjectColumns} />
              : "Loading tRPC query..."
          }
        </div>
      </main>
    </>
  );
};

export default Home;
