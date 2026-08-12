import urllib.request, json, sys

token = "XOdleksyrJOfQfDX19EdiAYL2YVawNss3IxelH-y76X"
url = "https://backboard.railway.com/graphql/v2"
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def gql(query, variables=None):
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, headers=headers)
    resp = urllib.request.urlopen(req).read()
    return json.loads(resp)

# 1. Introspect Builder enum and ServiceInstanceUpdateInput
q = """
{
  builder: __type(name: "Builder") { enumValues { name } }
  input: __type(name: "ServiceInstanceUpdateInput") { inputFields { name } }
}
"""
r = gql(q)
print("Builder enum:", [v["name"] for v in r["data"]["builder"]["enumValues"]])
print()
print("ServiceInstanceUpdateInput fields:")
for f in r["data"]["input"]["inputFields"]:
    print(" ", f["name"])
