import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

type MailTemplateData = Record<string, string | number | boolean | null | undefined>;

/**
 * Queue an email via the Firebase Trigger Email extension (`mail` collection).
 */
export async function queueCreatorEmail(
  to: string,
  templateName: string,
  data: MailTemplateData
): Promise<void> {
  if (!to?.trim()) return;

  await db.collection("mail").add({
    to: to.trim(),
    template: {
      name: templateName,
      data,
    },
  });
}
