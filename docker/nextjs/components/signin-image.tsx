import Image from "next/image";
import signinImage from "../public/images/main-image.jpg";

export function SignInImage() {
  return (
    <div className="relative hidden bg-muted lg:block">
      <Image
        src={signinImage}
        alt="Signin Image"
        style={{ objectFit: "cover" }}
        fill={true}
      />
    </div>
  );
}
