import { addProperty, signUp } from './support';

/** Makes the organisation the browser tests share, and hands it to them through the environment. */
export default async function globalSetup(): Promise<void> {
  const owner = await signUp('Browser');
  const property = await addProperty(owner, 2);
  process.env.E2E_OWNER_EMAIL = owner.email;
  process.env.E2E_OWNER_PASSWORD = owner.password;
  process.env.E2E_BRANCH_ID = property.branchId;
  process.env.E2E_ROOM_TYPE_ID = property.roomTypeId;
  process.env.E2E_ROOM_IDS = property.roomIds.join(',');
}
