import { deleteOrganisation, signIn } from './support';

/** Deletes the shared organisation, the way its owner would. */
export default async function globalTeardown(): Promise<void> {
  const email = process.env.E2E_OWNER_EMAIL;
  const password = process.env.E2E_OWNER_PASSWORD;
  if (email && password) await deleteOrganisation(await signIn(email, password));
}
