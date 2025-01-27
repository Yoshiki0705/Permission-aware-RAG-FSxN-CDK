import { NextRequest, NextResponse } from "next/server";
export async function middleware(request: NextRequest) {
  const session = request.cookies.has("jwtToken");
  console.log(request.cookies);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
