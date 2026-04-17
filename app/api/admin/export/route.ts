import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getStore } from "@/lib/repository";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const store = await getStore();

  return new NextResponse(JSON.stringify(store, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="nav-atlas-export.json"'
    }
  });
}
