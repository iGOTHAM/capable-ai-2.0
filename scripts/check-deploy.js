const path = require('path');
const clientPath = path.join(__dirname, '..', 'node_modules', '.pnpm', '@prisma+client@6.19.2_prisma@6.19.2_typescript@5.9.3__typescript@5.9.3', 'node_modules', '@prisma', 'client');
const { PrismaClient } = require(clientPath);
const db = new PrismaClient();

db.project.findFirst({
  where: { id: 'cml8lqqs20001jo04do0j2msk' },
  include: { deployment: true },
}).then(project => {
  if (project && project.deployment) {
    const d = project.deployment;
    console.log('Status:', d.status);
    console.log('IP:', d.dropletIp);
    console.log('Subdomain:', d.subdomain);
    console.log('Last heartbeat:', d.lastHeartbeat);
    const hd = d.heartbeatData;
    if (hd && typeof hd === 'object') {
      // Print the full admin secret so we can use it for direct dashboard calls
      console.log('adminSecret:', hd.adminSecret || 'NOT SET');
      console.log('dashboardPassword:', hd.dashboardPassword ? 'SET' : 'NOT SET');
    }
  } else {
    console.log('No deployment found');
  }
  return db.$disconnect();
}).catch(e => { console.error(e); process.exit(1); });
