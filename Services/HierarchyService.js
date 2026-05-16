import {
  FederalAdmin,
  RegionalAdmin,
  ZoneAdmin,
  WoredaAdmin,
  KebeleAdmin,
  HospitalAdmin,
  HospitalStaff
} from "../associations/index.js";

class HierarchyService {
  
  // Get all admins at a specific level
  static async getAllAdminsAtLevel(level) {
    switch(level) {
      case 'federal':
        return await FederalAdmin.findAll({ attributes: ['id', 'first_name', 'last_name'] });
      case 'regional':
        return await RegionalAdmin.findAll({ attributes: ['id', 'first_name', 'last_name', 'region_name'] });
      case 'zone':
        return await ZoneAdmin.findAll({ 
          attributes: ['id', 'first_name', 'last_name', 'zone_name'],
          include: [{ model: RegionalAdmin, as: 'regionalAdmin', attributes: ['region_name'] }]
        });
      case 'woreda':
        return await WoredaAdmin.findAll({ 
          attributes: ['id', 'first_name', 'last_name', 'woreda_name'],
          include: [{ model: ZoneAdmin, as: 'zoneAdmin', attributes: ['zone_name'] }]
        });
      case 'kebele':
        return await KebeleAdmin.findAll({ 
          attributes: ['id', 'first_name', 'last_name', 'kebele_name'],
          include: [{ model: WoredaAdmin, as: 'woredaAdmin', attributes: ['woreda_name'] }]
        });
      case 'hospital':
        return await HospitalAdmin.findAll({ 
          attributes: ['id', 'first_name', 'last_name', 'hospital_name'],
          include: [{ model: KebeleAdmin, as: 'kebeleAdmin', attributes: ['kebele_name'] }]
        });
      case 'staff':
        return await HospitalStaff.findAll({ 
          attributes: ['id', 'first_name', 'last_name', 'position'],
          include: [{ model: HospitalAdmin, as: 'hospitalAdmin', attributes: ['hospital_name'] }]
        });
      default:
        return [];
    }
  }
  
  // Get admin details by id and type
  static async getAdminDetails(id, type) {
    let admin = null;
    let details = {
      id,
      type,
      name: '',
      region: '',
      zone: '',
      woreda: '',
      kebele: '',
      hospital: ''
    };
    
    switch(type) {
      case 'federal':
        admin = await FederalAdmin.findByPk(id);
        if (admin) {
          details.name = `${admin.first_name} ${admin.last_name}`;
        }
        break;
      case 'regional':
        admin = await RegionalAdmin.findByPk(id);
        if (admin) {
          details.name = `${admin.first_name} ${admin.last_name}`;
          details.region = admin.region_name;
        }
        break;
      case 'zone':
        admin = await ZoneAdmin.findByPk(id, {
          include: [{ model: RegionalAdmin, as: 'regionalAdmin' }]
        });
        if (admin) {
          details.name = `${admin.first_name} ${admin.last_name}`;
          details.zone = admin.zone_name;
          details.region = admin.regionalAdmin?.region_name || '';
        }
        break;
      case 'woreda':
        admin = await WoredaAdmin.findByPk(id, {
          include: [{ model: ZoneAdmin, as: 'zoneAdmin', include: [{ model: RegionalAdmin, as: 'regionalAdmin' }] }]
        });
        if (admin) {
          details.name = `${admin.first_name} ${admin.last_name}`;
          details.woreda = admin.woreda_name;
          details.zone = admin.zoneAdmin?.zone_name || '';
          details.region = admin.zoneAdmin?.regionalAdmin?.region_name || '';
        }
        break;
      case 'kebele':
        admin = await KebeleAdmin.findByPk(id, {
          include: [{ 
            model: WoredaAdmin, as: 'woredaAdmin',
            include: [{ 
              model: ZoneAdmin, as: 'zoneAdmin',
              include: [{ model: RegionalAdmin, as: 'regionalAdmin' }]
            }]
          }]
        });
        if (admin) {
          details.name = `${admin.first_name} ${admin.last_name}`;
          details.kebele = admin.kebele_name;
          details.woreda = admin.woredaAdmin?.woreda_name || '';
          details.zone = admin.woredaAdmin?.zoneAdmin?.zone_name || '';
          details.region = admin.woredaAdmin?.zoneAdmin?.regionalAdmin?.region_name || '';
        }
        break;
      case 'hospital':
        admin = await HospitalAdmin.findByPk(id, {
          include: [{ 
            model: KebeleAdmin, as: 'kebeleAdmin',
            include: [{ 
              model: WoredaAdmin, as: 'woredaAdmin',
              include: [{ 
                model: ZoneAdmin, as: 'zoneAdmin',
                include: [{ model: RegionalAdmin, as: 'regionalAdmin' }]
              }]
            }]
          }]
        });
        if (admin) {
          details.name = `${admin.first_name} ${admin.last_name}`;
          details.hospital = admin.hospital_name;
          details.kebele = admin.kebeleAdmin?.kebele_name || '';
          details.woreda = admin.kebeleAdmin?.woredaAdmin?.woreda_name || '';
          details.zone = admin.kebeleAdmin?.woredaAdmin?.zoneAdmin?.zone_name || '';
          details.region = admin.kebeleAdmin?.woredaAdmin?.zoneAdmin?.regionalAdmin?.region_name || '';
        }
        break;
      case 'staff':
        admin = await HospitalStaff.findByPk(id, {
          include: [{ 
            model: HospitalAdmin, as: 'hospitalAdmin',
            include: [{ 
              model: KebeleAdmin, as: 'kebeleAdmin',
              include: [{ 
                model: WoredaAdmin, as: 'woredaAdmin',
                include: [{ 
                  model: ZoneAdmin, as: 'zoneAdmin',
                  include: [{ model: RegionalAdmin, as: 'regionalAdmin' }]
                }]
              }]
            }]
          }]
        });
        if (admin) {
          details.name = `${admin.first_name} ${admin.last_name}`;
          details.hospital = admin.hospitalAdmin?.hospital_name || '';
          details.kebele = admin.hospitalAdmin?.kebeleAdmin?.kebele_name || '';
          details.woreda = admin.hospitalAdmin?.kebeleAdmin?.woredaAdmin?.woreda_name || '';
          details.zone = admin.hospitalAdmin?.kebeleAdmin?.woredaAdmin?.zoneAdmin?.zone_name || '';
          details.region = admin.hospitalAdmin?.kebeleAdmin?.woredaAdmin?.zoneAdmin?.regionalAdmin?.region_name || '';
        }
        break;
    }
    
    return details;
  }
  
  // Get all subordinates for an admin
  static async getSubordinates(adminId, adminType) {
    let subordinates = [];
    
    switch(adminType) {
      case 'federal':
        const regionals = await RegionalAdmin.findAll({ 
          where: { federal_id: adminId },
          attributes: ['id', 'first_name', 'last_name', 'region_name']
        });
        subordinates.push(...regionals.map(r => ({
          id: r.id,
          type: 'regional',
          name: `${r.first_name} ${r.last_name}`,
          region: r.region_name
        })));
        break;
        
      case 'regional':
        const zones = await ZoneAdmin.findAll({ 
          where: { regional_id: adminId },
          attributes: ['id', 'first_name', 'last_name', 'zone_name']
        });
        subordinates.push(...zones.map(z => ({
          id: z.id,
          type: 'zone',
          name: `${z.first_name} ${z.last_name}`,
          zone: z.zone_name
        })));
        break;
        
      case 'zone':
        const woredas = await WoredaAdmin.findAll({ 
          where: { zone_id: adminId },
          attributes: ['id', 'first_name', 'last_name', 'woreda_name']
        });
        subordinates.push(...woredas.map(w => ({
          id: w.id,
          type: 'woreda',
          name: `${w.first_name} ${w.last_name}`,
          woreda: w.woreda_name
        })));
        break;
        
      case 'woreda':
        const kebeles = await KebeleAdmin.findAll({ 
          where: { woreda_id: adminId },
          attributes: ['id', 'first_name', 'last_name', 'kebele_name']
        });
        subordinates.push(...kebeles.map(k => ({
          id: k.id,
          type: 'kebele',
          name: `${k.first_name} ${k.last_name}`,
          kebele: k.kebele_name
        })));
        break;
        
      case 'kebele':
        const hospitals = await HospitalAdmin.findAll({ 
          where: { kebele_id: adminId },
          attributes: ['id', 'first_name', 'last_name', 'hospital_name']
        });
        subordinates.push(...hospitals.map(h => ({
          id: h.id,
          type: 'hospital',
          name: `${h.first_name} ${h.last_name}`,
          hospital: h.hospital_name
        })));
        break;
        
      case 'hospital':
        const staff = await HospitalStaff.findAll({ 
          where: { hospital_id: adminId },
          attributes: ['id', 'first_name', 'last_name', 'position']
        });
        subordinates.push(...staff.map(s => ({
          id: s.id,
          type: 'staff',
          name: `${s.first_name} ${s.last_name}`,
          position: s.position
        })));
        break;
    }
    
    return subordinates;
  }
  
  // Get all superiors for an admin
  static async getSuperiors(adminId, adminType) {
    const superiors = [];
    const admin = await this.getAdminDetails(adminId, adminType);
    
    if (adminType === 'regional' && admin.federal_id) {
      const federal = await FederalAdmin.findByPk(admin.federal_id);
      if (federal) {
        superiors.push({
          id: federal.id,
          type: 'federal',
          name: `${federal.first_name} ${federal.last_name}`
        });
      }
    } else if (adminType === 'zone' && admin.regional_id) {
      const regional = await RegionalAdmin.findByPk(admin.regional_id);
      if (regional) {
        superiors.push({
          id: regional.id,
          type: 'regional',
          name: `${regional.first_name} ${regional.last_name}`,
          region: regional.region_name
        });
        
        // Add federal too
        if (regional.federal_id) {
          const federal = await FederalAdmin.findByPk(regional.federal_id);
          if (federal) {
            superiors.push({
              id: federal.id,
              type: 'federal',
              name: `${federal.first_name} ${federal.last_name}`
            });
          }
        }
      }
    }
    
    // Continue for other levels...
    
    return superiors;
  }
}

export default HierarchyService;