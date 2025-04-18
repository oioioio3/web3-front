import request from "@/utils/http";

const api_name = ''

export const test = (id) => {
    return request({
        url: `${api_name}/${id}`,
        method: 'get',
    })
};
