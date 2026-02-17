# Issue: localhost:3000 hangs from Docker host browser after reboot

## Symptoms

- <http://localhost:3000/> was accessible from Chrome on the docker host — now hangs
- Full system reboot was done, all containers came back up
- From INSIDE the dev container, curl to localhost:3000 returns HTML instantly (200 OK)
- Vite dev server process is running (node on port 3000, bound to 0.0.0.0)
- Docker port mapping shows 3000/tcp -> 0.0.0.0:3000

## Confirmed working

- Vite process alive (PID 1469)
- Port 3000 listening on 0.0.0.0 inside container
- curl from inside container gets 200 OK in <1ms
- Docker reports port forwarding 3000->3000 on 0.0.0.0 and [::]
- No uncommitted code changes (working tree clean except untracked docs)

## Key observation

The server responds inside the container. The problem is between the docker host and the container's port mapping.

---

## Diagnostic Steps (run from docker host, NOT inside the dev container)

### Step 1: Verify port 3000 is bound on the HOST

Run on the docker host (not inside any container):

    ss -tlnp | grep 3000

Expected: docker-proxy or similar listening on 0.0.0.0:3000
If nothing is listening, docker port forwarding failed silently.

### Step 2: Test raw TCP connectivity from the host

From the docker host:

    curl -v --connect-timeout 5 --max-time 10 http://localhost:3000/

If this hangs at "Trying 127.0.0.1:3000...", the issue is docker networking/iptables.
If it connects but hangs after headers, the issue is Vite response streaming.
If it works from curl but not Chrome, the issue is browser-specific (see Step 6).

### Step 3: Check if another process stole port 3000

From the docker host:

    ss -tlnp | grep 3000
    lsof -i :3000

After a reboot, another service may have grabbed port 3000 before docker started.
If a non-docker process is on 3000, that's the root cause.

### Step 4: Check docker iptables/nftables rules

Docker relies on iptables NAT rules for port forwarding. After a reboot these can be lost or blocked.

From the docker host:

    sudo iptables -t nat -L -n | grep 3000
    sudo iptables -L DOCKER -n

Look for DNAT rules routing host 3000 to the container IP (172.23.0.6:3000).
If missing, docker networking is broken. Fix: restart docker daemon or recreate the container.

### Step 5: Check if docker-proxy is running

Docker uses docker-proxy processes for port forwarding:

    ps aux | grep docker-proxy | grep 3000

If no docker-proxy for 3000, the port forwarding is broken despite what `docker port` reports.
Fix: docker restart gofr-console-dev (or docker compose down/up)

### Step 6: Browser-specific checks

If curl works from host but Chrome doesn't:

- Clear browser cache / try incognito
- Check Chrome's net-internals: chrome://net-internals/#sockets (look for stale pool entries for localhost:3000)
- Try a different browser (Firefox, curl, wget)
- Check if a browser extension is interfering (try with extensions disabled)
- HSTS: Chrome may have cached an HSTS redirect for localhost to HTTPS — check chrome://net-internals/#hsts and delete localhost entry

### Step 7: Check for VS Code port forwarding conflict

VS Code dev containers auto-forward ports. After a reboot, VS Code might be trying to forward port 3000 separately, creating a conflict:

- In VS Code: check the PORTS panel (bottom bar)
- If port 3000 shows as forwarded by VS Code, it may be intercepting
- Try removing the VS Code port forward and rely only on docker's port mapping
- Or vice versa: if docker mapping is broken, let VS Code handle the forwarding

### Step 8: Check docker daemon health

    sudo systemctl status docker
    sudo journalctl -u docker --since "10 minutes ago" --no-pager

Look for errors related to networking, iptables, or port binding after reboot.

### Step 9: Nuclear option — recreate the container

If the above don't reveal the issue:

    docker stop gofr-console-dev
    docker rm gofr-console-dev
    # re-run whatever compose/run command creates it
    # then restart the Vite dev server inside

This forces docker to re-establish all port mappings and network config.

---

## Most likely causes (ranked by probability after reboot)

1. **VS Code port forwarding conflict** — VS Code may have auto-forwarded port 3000, which now conflicts or intercepts
2. **Docker iptables rules not restored** — after reboot, docker networking rules may not have been properly re-established
3. **Docker-proxy not started** — the port forward looks configured but the proxy process never spawned
4. **Another service on port 3000** — something else grabbed the port first on the host
5. **Browser HSTS/cache issue** — Chrome caching a redirect or stale connection

## How to validate

Each step above includes what to look for and what finding confirms the root cause. Work through them in order from the docker host terminal — all the in-container checks are already confirmed working.
