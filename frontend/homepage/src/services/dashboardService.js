import API from "./api";

export const getDashboardData = async () => {
  const token = localStorage.getItem("token");

  const res = await API.get("/auth", {
    headers: {
      Authorization: token
    }
  });

  return res.data;
};
