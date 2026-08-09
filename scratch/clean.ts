import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Cleaning LID duplicates in database...");

  const allParticipants = await prisma.participant.findMany({
    orderBy: { updatedAt: "desc" },
  });

  const lidRows = allParticipants.filter((p) => !p.phoneNumber.startsWith("62"));
  const realRows = allParticipants.filter((p) => p.phoneNumber.startsWith("62"));

  console.log(`Found ${lidRows.length} LID rows and ${realRows.length} real 62 rows.`);

  for (const lid of lidRows) {
    const matchReal = realRows.find(
      (r) => r.name === lid.name || (lid.name && r.name && r.name.toLowerCase().includes(lid.name.toLowerCase()))
    );

    if (matchReal) {
      console.log(`Merging LID ${lid.phoneNumber} (${lid.name}) into real ${matchReal.phoneNumber}...`);
      await prisma.participant.update({
        where: { id: matchReal.id },
        data: {
          name: lid.name || matchReal.name,
          studentClass: lid.studentClass || matchReal.studentClass,
          motivation: lid.motivation || matchReal.motivation,
          hobby: lid.hobby || matchReal.hobby,
          status: lid.status !== "NOT_STARTED" ? lid.status : matchReal.status,
        },
      });
      await prisma.participant.delete({ where: { id: lid.id } });
    } else if (lid.name && lid.status === "COMPLETED") {
      const uncompletedReal = realRows.find((r) => r.status !== "COMPLETED");
      if (uncompletedReal) {
        console.log(
          `Merging COMPLETED LID ${lid.phoneNumber} (${lid.name}) into uncompleted real ${uncompletedReal.phoneNumber}...`
        );
        await prisma.participant.update({
          where: { id: uncompletedReal.id },
          data: {
            name: lid.name,
            studentClass: lid.studentClass,
            motivation: lid.motivation,
            hobby: lid.hobby,
            status: "COMPLETED",
          },
        });
        await prisma.participant.delete({ where: { id: lid.id } });
      }
    }
  }

  console.log("Database cleanup complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
