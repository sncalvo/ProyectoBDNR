import { type NextPage } from "next";
import Head from "next/head";
import { ColumnDef } from "@tanstack/react-table";
import { api, type RouterOutputs } from "~/utils/api";
import { UserButton } from "@clerk/nextjs";
import { DataTable } from "~/components/molecules/DataTable";
import { Button } from "~/components/Button";
import { Input } from "~/components/Input";
import { useState } from "react";

import { debounce } from "debounce";

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
  {
    accessorKey: "passed",
    header: "Passed"
  },
  {
    id: "action",
    cell: ({ row }) => {
      const utils = api.useContext();
      const markPassed = api.subjects.addPassed.useMutation({
        onSuccess: () => utils.subjects.invalidate(),
      });
      const removePassed = api.subjects.removePassed.useMutation({
        onSuccess: () => utils.subjects.invalidate(),
      });

      if (row.original.passed) {
        return (
          <Button variant="destructive" onClick={() => removePassed.mutate({ code: row.original.code })} loading={removePassed.isLoading}>
            Marcar No Pronto
          </Button>
        );
      }

      return (
        <Button variant="default" onClick={() => markPassed.mutate({ code: row.original.code })} loading={markPassed.isLoading}>
          Marcar Pronto
        </Button>
      );
    },
  }
]


const Home: NextPage = () => {
  const [nameSearch, setNameSearch] = useState<string | undefined>();
  const subjects = api.subjects.all.useQuery(nameSearch);

  const setSearch = debounce(setNameSearch, 200);

  return (
    <>
      <h2 className="cursor-pointer text-[1.5rem] font-extrabold tracking-tight text-accent">
        Materias
      </h2>
      <div className="flex w-96 my-3">
        <Input type="text" placeholder="Search" onChange={(event) => setSearch(event.target.value)} />
      </div>
      <div className="container flex flex-col items-center justify-center px-4 py-16">
        {
          subjects.data
            ? <DataTable data={subjects.data} columns={subjectColumns} />
            : "Loading tRPC query..."
        }
      </div>
    </>
  );
};

export default Home;
