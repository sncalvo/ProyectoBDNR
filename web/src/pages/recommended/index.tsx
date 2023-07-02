import { type NextPage } from "next";
import Head from "next/head";
import { ColumnDef } from "@tanstack/react-table";
import { api, type RouterOutputs } from "~/utils/api";
import { UserButton } from "@clerk/nextjs";
import { DataTable } from "~/components/molecules/DataTable";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/Popover"
import { Info, Loader2 } from 'lucide-react';

type Subject = RouterOutputs["subjects"]["recommended"][number]

const subjectColumns: ColumnDef<Subject>[] = [
  {
    accessorKey: "code",
    header: "Código"
  },
  {
    accessorKey: "name",
    header: "Nombre"
  },
  {
    accessorKey: "credits",
    header: "Créditos"
  },
  {
    accessorKey: "originators",
    header: "Originadores",
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Popover>
          <PopoverTrigger asChild>
            <Info className="cursor-pointer" />
          </PopoverTrigger>
          <PopoverContent>
            <div className="flex flex-col gap-2">
              { row.original.originators.map((subject) => <div>{subject.name}</div>)}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    )
  }
]


const Recommended: NextPage = () => {
  const subjects = api.subjects.recommended.useQuery();

  return (
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
          <UserButton />
        </div>
      </header>
      <main className="flex flex-col items-center">
        <h2 className="text-[1.5rem] font-extrabold tracking-tight text-accent">
          Recomendaciones
        </h2>
        <p>
          ¡Éstas son las materias que cumplis con la mayor cantidad de previas!
        </p>
        <div className="container flex flex-col items-center justify-center px-4 pt-5 ">
          {
            subjects.data
              ? <DataTable data={subjects.data} columns={subjectColumns} />
              : <Loader2 className="animate animate-spin" />
          }
        </div>
      </main>
    </>
  );
};

export default Recommended;
