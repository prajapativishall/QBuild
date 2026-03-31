import API from "./api";

export const getAudits = async () => {
  const res = await API.get("/audit");
  return res.data;
};
