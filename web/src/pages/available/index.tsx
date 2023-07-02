import { type NextPage } from "next";
import Head from "next/head";
import { ColumnDef } from "@tanstack/react-table";
import { api, type RouterOutputs } from "~/utils/api";
import { UserButton } from "@clerk/nextjs";
import { DataTable } from "~/components/molecules/DataTable";
import { Loader2 } from "lucide-react";

type Available = RouterOutputs["subjects"]["available"][number]

const subjectColumns: ColumnDef<Available>[] = [
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
  }
]


const Recommended: NextPage = () => {
  const subjects = api.subjects.available.useQuery();

  return (
    <>
      <h2 className="text-[1.5rem] font-extrabold tracking-tight text-accent">
        Materias Habilitadas
      </h2>
      <p>
        ¡Éstas son las materias que cumplís con sus previas!
      </p>
      <div className="container flex flex-col items-center justify-center px-4 pt-5">
        {
          subjects.data
            ? <DataTable data={subjects.data} columns={subjectColumns} />
            : <Loader2 className="animate animate-spin" />
        }
      </div>
    </>
  );
};

export default Recommended;
