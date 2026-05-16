import {
  FederalAdmin,
  RegionalAdmin,
  ZoneAdmin,
  WoredaAdmin,
  KebeleAdmin,
  HospitalAdmin,
  HospitalStaff
} from "../models/index.js";

class UserService {
  
  // Get complete user details by ID and type
  static async getUserDetails(id, type) {
    let user = null;
    let details = {
      id,
      type,
      first_name: '',
      middle_name: '',
      last_name: '',
      full_name: '',
      title: '',
      region: '',
      zone: '',
      woreda: '',
      kebele: '',
      hospital: '',
      department: '',
      ward: '',
      parent_id: null,
      parent_type: null
    };
    
    try {
      switch(type) {
        case 'federal':
          user = await FederalAdmin.findByPk(id);
          if (user) {
            details.first_name = user.first_name;
            details.middle_name = user.middle_name || '';
            details.last_name = user.last_name;
            details.full_name = `${user.first_name} ${user.middle_name ? user.middle_name + ' ' : ''}${user.last_name}`.trim();
            details.title = 'Federal Admin';
            details.region = 'Federal';
          }
          break;
          
        case 'regional':
          user = await RegionalAdmin.findByPk(id, {
            include: [{ model: FederalAdmin, as: 'federal' }]
          });
          if (user) {
            details.first_name = user.first_name;
            details.middle_name = user.middle_name || '';
            details.last_name = user.last_name;
            details.full_name = `${user.first_name} ${user.middle_name ? user.middle_name + ' ' : ''}${user.last_name}`.trim();
            details.title = `Regional Admin - ${user.region_name}`;
            details.region = user.region_name;
            details.parent_id = user.federal_id;
            details.parent_type = 'federal';
          }
          break;
          
        case 'zone':
          user = await ZoneAdmin.findByPk(id, {
            include: [{ 
              model: RegionalAdmin, as: 'regional',
              include: [{ model: FederalAdmin, as: 'federal' }]
            }]
          });
          if (user) {
            details.first_name = user.first_name;
            details.middle_name = user.middle_name || '';
            details.last_name = user.last_name;
            details.full_name = `${user.first_name} ${user.middle_name ? user.middle_name + ' ' : ''}${user.last_name}`.trim();
            details.title = `Zone Admin - ${user.zone_name}`;
            details.zone = user.zone_name;
            details.region = user.regional?.region_name || '';
            details.parent_id = user.regional_id;
            details.parent_type = 'regional';
          }
          break;
          
        case 'woreda':
          user = await WoredaAdmin.findByPk(id, {
            include: [{ 
              model: ZoneAdmin, as: 'zone',
              include: [{ 
                model: RegionalAdmin, as: 'regional',
                include: [{ model: FederalAdmin, as: 'federal' }]
              }]
            }]
          });
          if (user) {
            details.first_name = user.first_name;
            details.middle_name = user.middle_name || '';
            details.last_name = user.last_name;
            details.full_name = `${user.first_name} ${user.middle_name ? user.middle_name + ' ' : ''}${user.last_name}`.trim();
            details.title = `Woreda Admin - ${user.woreda_name}`;
            details.woreda = user.woreda_name;
            details.zone = user.zone?.zone_name || '';
            details.region = user.zone?.regional?.region_name || '';
            details.parent_id = user.zone_id;
            details.parent_type = 'zone';
          }
          break;
          
        case 'kebele':
          user = await KebeleAdmin.findByPk(id, {
            include: [{ 
              model: WoredaAdmin, as: 'woreda',
              include: [{ 
                model: ZoneAdmin, as: 'zone',
                include: [{ 
                  model: RegionalAdmin, as: 'regional',
                  include: [{ model: FederalAdmin, as: 'federal' }]
                }]
              }]
            }]
          });
          if (user) {
            details.first_name = user.first_name;
            details.middle_name = user.middle_name || '';
            details.last_name = user.last_name;
            details.full_name = `${user.first_name} ${user.middle_name ? user.middle_name + ' ' : ''}${user.last_name}`.trim();
            details.title = `Kebele Admin - ${user.kebele_name}`;
            details.kebele = user.kebele_name;
            details.woreda = user.woreda?.woreda_name || '';
            details.zone = user.woreda?.zone?.zone_name || '';
            details.region = user.woreda?.zone?.regional?.region_name || '';
            details.parent_id = user.woreda_id;
            details.parent_type = 'woreda';
          }
          break;
          
        case 'hospital':
          user = await HospitalAdmin.findByPk(id, {
            include: [{ 
              model: KebeleAdmin, as: 'kebele',
              include: [{ 
                model: WoredaAdmin, as: 'woreda',
                include: [{ 
                  model: ZoneAdmin, as: 'zone',
                  include: [{ 
                    model: RegionalAdmin, as: 'regional',
                    include: [{ model: FederalAdmin, as: 'federal' }]
                  }]
                }]
              }]
            }]
          });
          if (user) {
            details.first_name = user.first_name;
            details.middle_name = user.middle_name || '';
            details.last_name = user.last_name;
            details.full_name = `${user.first_name} ${user.middle_name ? user.middle_name + ' ' : ''}${user.last_name}`.trim();
            details.title = `Hospital Admin - ${user.hospital_name}`;
            details.hospital = user.hospital_name;
            details.kebele = user.kebele?.kebele_name || '';
            details.woreda = user.kebele?.woreda?.woreda_name || '';
            details.zone = user.kebele?.woreda?.zone?.zone_name || '';
            details.region = user.kebele?.woreda?.zone?.regional?.region_name || '';
            details.parent_id = user.kebele_id;
            details.parent_type = 'kebele';
          }
          break;
          
        case 'staff':
          user = await HospitalStaff.findByPk(id, {
            include: [{ 
              model: HospitalAdmin, as: 'hospital',
              include: [{ 
                model: KebeleAdmin, as: 'kebele',
                include: [{ 
                  model: WoredaAdmin, as: 'woreda',
                  include: [{ 
                    model: ZoneAdmin, as: 'zone',
                    include: [{ 
                      model: RegionalAdmin, as: 'regional',
                      include: [{ model: FederalAdmin, as: 'federal' }]
                    }]
                  }]
                }]
              }]
            }]
          });
          if (user) {
            details.first_name = user.first_name;
            details.middle_name = user.middle_name || '';
            details.last_name = user.last_name;
            details.full_name = `${user.first_name} ${user.middle_name ? user.middle_name + ' ' : ''}${user.last_name}`.trim();
            details.title = `${user.department} - ${user.hospital?.hospital_name || ''}`;
            details.hospital = user.hospital?.hospital_name || '';
            details.kebele = user.hospital?.kebele?.kebele_name || '';
            details.woreda = user.hospital?.kebele?.woreda?.woreda_name || '';
            details.zone = user.hospital?.kebele?.woreda?.zone?.zone_name || '';
            details.region = user.hospital?.kebele?.woreda?.zone?.regional?.region_name || '';
            details.department = user.department;
            details.ward = user.ward;
            details.parent_id = user.hospital_id;
            details.parent_type = 'hospital';
          }
          break;
      }
      
      return details;
    } catch (error) {
      console.error("Error getting user details:", error);
      return details;
    }
  }
  
  // Get all subordinates for a user
  static async getSubordinates(userId, userType) {
    try {
      let subordinates = [];
      
      switch(userType) {
        case 'federal':
          const regions = await RegionalAdmin.findAll({
            where: { federal_id: userId, status: 'active' },
            attributes: ['id', 'first_name', 'last_name', 'region_name', 'email']
          });
          subordinates = regions.map(r => ({
            id: r.id,
            type: 'regional',
            name: `${r.first_name} ${r.last_name}`,
            region: r.region_name,
            email: r.email
          }));
          break;
          
        case 'regional':
          const zones = await ZoneAdmin.findAll({
            where: { regional_id: userId, status: 'active' },
            attributes: ['id', 'first_name', 'last_name', 'zone_name', 'email']
          });
          subordinates = zones.map(z => ({
            id: z.id,
            type: 'zone',
            name: `${z.first_name} ${z.last_name}`,
            zone: z.zone_name,
            email: z.email
          }));
          break;
          
        case 'zone':
          const woredas = await WoredaAdmin.findAll({
            where: { zone_id: userId, status: 'active' },
            attributes: ['id', 'first_name', 'last_name', 'woreda_name', 'email']
          });
          subordinates = woredas.map(w => ({
            id: w.id,
            type: 'woreda',
            name: `${w.first_name} ${w.last_name}`,
            woreda: w.woreda_name,
            email: w.email
          }));
          break;
          
        case 'woreda':
          const kebeles = await KebeleAdmin.findAll({
            where: { woreda_id: userId, status: 'active' },
            attributes: ['id', 'first_name', 'last_name', 'kebele_name', 'email']
          });
          subordinates = kebeles.map(k => ({
            id: k.id,
            type: 'kebele',
            name: `${k.first_name} ${k.last_name}`,
            kebele: k.kebele_name,
            email: k.email
          }));
          break;
          
        case 'kebele':
          const hospitals = await HospitalAdmin.findAll({
            where: { kebele_id: userId, status: 'active' },
            attributes: ['id', 'first_name', 'last_name', 'hospital_name', 'email']
          });
          subordinates = hospitals.map(h => ({
            id: h.id,
            type: 'hospital',
            name: `${h.first_name} ${h.last_name}`,
            hospital: h.hospital_name,
            email: h.email
          }));
          break;
          
        case 'hospital':
          const staff = await HospitalStaff.findAll({
            where: { hospital_id: userId, status: 'active' },
            attributes: ['id', 'first_name', 'last_name', 'department', 'ward', 'email']
          });
          subordinates = staff.map(s => ({
            id: s.id,
            type: 'staff',
            name: `${s.first_name} ${s.last_name}`,
            department: s.department,
            ward: s.ward,
            email: s.email
          }));
          break;
          
        case 'staff':
          // Staff have no subordinates
          break;
      }
      
      return subordinates;
    } catch (error) {
      console.error("Error getting subordinates:", error);
      return [];
    }
  }
}

export default UserService;