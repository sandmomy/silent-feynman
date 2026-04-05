const CF_API = "https://api.cloudflare.com/client/v4";

export async function queryD1(sql, params = []) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const dbId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_D1_TOKEN;

  if (!accountId || !dbId || !token) {
    throw new Error("Cloudflare D1 environment variables are not configured.");
  }

  const response = await fetch(
    `${CF_API}/accounts/${accountId}/d1/database/${dbId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    }
  );

  const data = await response.json();

  if (!data.success) {
    const msg = data.errors?.map((e) => e.message).join(", ") || "D1 query failed";
    throw new Error(msg);
  }

  return data.result?.[0]?.results || [];
}
