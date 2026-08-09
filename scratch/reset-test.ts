import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Resetting test participant for fresh registration test...");

  await prisma.participant.updateMany({
    where: {
      status: { notIn: ["COMPLETED", "OPTED_OUT"] },
    },
    data: {
      status: "WAITING_CONFIRMATION",
      name: null,
      studentClass: null,
      motivation: null,
      hobby: null,
    },
  });

  console.log("Reset complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
