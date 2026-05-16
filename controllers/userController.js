import FederalAdmin from "../models/FederalAdmin.js";
import RegionalAdmin from "../models/RegionalAdmin.js";
import ZoneAdmin from "../models/ZoneAdmin.js";
import WoredaAdmin from "../models/WoredaAdmin.js";
import KebeleAdmin from "../models/KebeleAdmin.js";
import HospitalAdmin from "../models/HospitalAdmin.js";
import HospitalStaff from "../models/HospitalStaff.js";
import { Op } from "sequelize";

// Get users by level with hierarchical filtering
export const getUsersByLevel = async (req, res) => {
  try {
    const { level, federal_id, regional_id, zone_id, woreda_id, kebele_id, hospital_id, id } = req.query;
    
    console.log(`📋 Fetching users for level: ${level}`, { 
      federal_id, regional_id, zone_id, woreda_id, kebele_id, hospital_id, id 
    });

    let users = [];
    let whereClause = {};

    // Build query based on level and filters
    switch(level) {
      case 'federal':
        // If specific id is provided (for regional's federal)
        if (id) {
          whereClause.id = id;
        }
        const federals = await FederalAdmin.findAll({
          where: whereClause,
          attributes: ['id', 'first_name', 'middle_name', 'last_name', 'email', 'phone']
        });
        users = federals.map(f => ({
          id: f.id,
          full_name: `${f.first_name} ${f.middle_name ? f.middle_name + ' ' : ''}${f.last_name}`.trim(),
          first_name: f.first_name,
          last_name: f.last_name,
          email: f.email,
          phone: f.phone,
          type: 'federal'
        }));
        break;

      case 'regional':
        // Reset whereClause
        whereClause = {};
        
        // If specific id is provided (for zone's specific regional admin)
        if (id) {
          whereClause.id = id;
          console.log(`🔍 Fetching SPECIFIC regional admin with id: ${id}`);
          
          // Find ONE specific regional admin
          const regional = await RegionalAdmin.findOne({
            where: whereClause,
            attributes: ['id', 'first_name', 'middle_name', 'last_name', 'region_name', 'email', 'phone']
          });
          
          if (regional) {
            users = [{
              id: regional.id,
              full_name: `${regional.first_name} ${regional.middle_name ? regional.middle_name + ' ' : ''}${regional.last_name}`.trim(),
              first_name: regional.first_name,
              last_name: regional.last_name,
              region_name: regional.region_name,
              email: regional.email,
              phone: regional.phone,
              type: 'regional',
              is_single: true // Flag to indicate this is a single item
            }];
          }
        } else if (federal_id) {
          // Filter by federal_id if provided
          whereClause.federal_id = federal_id;
          const regionals = await RegionalAdmin.findAll({
            where: whereClause,
            attributes: ['id', 'first_name', 'middle_name', 'last_name', 'region_name', 'email', 'phone']
          });
          users = regionals.map(r => ({
            id: r.id,
            full_name: `${r.first_name} ${r.middle_name ? r.middle_name + ' ' : ''}${r.last_name}`.trim(),
            first_name: r.first_name,
            last_name: r.last_name,
            region_name: r.region_name,
            email: r.email,
            phone: r.phone,
            type: 'regional'
          }));
        }
        break;

      case 'zone':
        // Reset whereClause for this case
        whereClause = {};
        
        // If specific id is provided (for woreda's specific zone)
        if (id) {
          whereClause.id = id;
          console.log(`🔍 Fetching SPECIFIC zone admin with id: ${id}`);
          
          const zone = await ZoneAdmin.findOne({
            where: whereClause,
            attributes: ['id', 'first_name', 'middle_name', 'last_name', 'zone_name', 'email', 'phone'],
            include: [{
              model: RegionalAdmin,
              as: 'regional',
              attributes: ['region_name']
            }]
          });
          
          if (zone) {
            users = [{
              id: zone.id,
              full_name: `${zone.first_name} ${zone.middle_name ? zone.middle_name + ' ' : ''}${zone.last_name}`.trim(),
              first_name: zone.first_name,
              last_name: zone.last_name,
              zone_name: zone.zone_name,
              region_name: zone.regional?.region_name,
              email: zone.email,
              phone: zone.phone,
              type: 'zone',
              is_single: true
            }];
          }
        } else if (regional_id) {
          // Filter by regional_id if provided
          whereClause.regional_id = regional_id;
          console.log(`🔍 Filtering zones by regional_id: ${regional_id}`);
          
          const zones = await ZoneAdmin.findAll({
            where: whereClause,
            attributes: ['id', 'first_name', 'middle_name', 'last_name', 'zone_name', 'email', 'phone'],
            include: [{
              model: RegionalAdmin,
              as: 'regional',
              attributes: ['region_name']
            }]
          });
          
          users = zones.map(z => ({
            id: z.id,
            full_name: `${z.first_name} ${z.middle_name ? z.middle_name + ' ' : ''}${z.last_name}`.trim(),
            first_name: z.first_name,
            last_name: z.last_name,
            zone_name: z.zone_name,
            region_name: z.regional?.region_name,
            email: z.email,
            phone: z.phone,
            type: 'zone'
          }));
        }
        break;

      case 'woreda':
        // Reset whereClause
        whereClause = {};
        
        // If specific id is provided (for kebele's specific woreda)
        if (id) {
          whereClause.id = id;
          console.log(`🔍 Fetching SPECIFIC woreda admin with id: ${id}`);
          
          const woreda = await WoredaAdmin.findOne({
            where: whereClause,
            attributes: ['id', 'first_name', 'middle_name', 'last_name', 'woreda_name', 'email', 'phone'],
            include: [{
              model: ZoneAdmin,
              as: 'zone',
              attributes: ['zone_name'],
              include: [{
                model: RegionalAdmin,
                as: 'regional',
                attributes: ['region_name']
              }]
            }]
          });
          
          if (woreda) {
            users = [{
              id: woreda.id,
              full_name: `${woreda.first_name} ${woreda.middle_name ? woreda.middle_name + ' ' : ''}${woreda.last_name}`.trim(),
              first_name: woreda.first_name,
              last_name: woreda.last_name,
              woreda_name: woreda.woreda_name,
              zone_name: woreda.zone?.zone_name,
              region_name: woreda.zone?.regional?.region_name,
              email: woreda.email,
              phone: woreda.phone,
              type: 'woreda',
              is_single: true
            }];
          }
        } else if (zone_id) {
          // Filter by zone_id if provided
          whereClause.zone_id = zone_id;
          console.log(`🔍 Filtering woredas by zone_id: ${zone_id}`);
          
          const woredas = await WoredaAdmin.findAll({
            where: whereClause,
            attributes: ['id', 'first_name', 'middle_name', 'last_name', 'woreda_name', 'email', 'phone'],
            include: [{
              model: ZoneAdmin,
              as: 'zone',
              attributes: ['zone_name'],
              include: [{
                model: RegionalAdmin,
                as: 'regional',
                attributes: ['region_name']
              }]
            }]
          });
          
          users = woredas.map(w => ({
            id: w.id,
            full_name: `${w.first_name} ${w.middle_name ? w.middle_name + ' ' : ''}${w.last_name}`.trim(),
            first_name: w.first_name,
            last_name: w.last_name,
            woreda_name: w.woreda_name,
            zone_name: w.zone?.zone_name,
            region_name: w.zone?.regional?.region_name,
            email: w.email,
            phone: w.phone,
            type: 'woreda'
          }));
        } else if (regional_id) {
          // If regional_id provided, get woredas through zones
          const zones = await ZoneAdmin.findAll({
            where: { regional_id },
            attributes: ['id']
          });
          const zoneIds = zones.map(z => z.id);
          if (zoneIds.length > 0) {
            whereClause.zone_id = { [Op.in]: zoneIds };
            console.log(`🔍 Filtering woredas by zone_ids: [${zoneIds.join(', ')}]`);
            
            const woredas = await WoredaAdmin.findAll({
              where: whereClause,
              attributes: ['id', 'first_name', 'middle_name', 'last_name', 'woreda_name', 'email', 'phone'],
              include: [{
                model: ZoneAdmin,
                as: 'zone',
                attributes: ['zone_name'],
                include: [{
                  model: RegionalAdmin,
                  as: 'regional',
                  attributes: ['region_name']
                }]
              }]
            });
            
            users = woredas.map(w => ({
              id: w.id,
              full_name: `${w.first_name} ${w.middle_name ? w.middle_name + ' ' : ''}${w.last_name}`.trim(),
              first_name: w.first_name,
              last_name: w.last_name,
              woreda_name: w.woreda_name,
              zone_name: w.zone?.zone_name,
              region_name: w.zone?.regional?.region_name,
              email: w.email,
              phone: w.phone,
              type: 'woreda'
            }));
          } else {
            // No zones found, return empty array
            return res.json({
              success: true,
              users: [],
              count: 0
            });
          }
        }
        break;

      case 'kebele':
        // Reset whereClause
        whereClause = {};
        
        // If specific id is provided
        if (id) {
          whereClause.id = id;
          console.log(`🔍 Fetching SPECIFIC kebele admin with id: ${id}`);
          
          const kebele = await KebeleAdmin.findOne({
            where: whereClause,
            attributes: ['id', 'first_name', 'middle_name', 'last_name', 'kebele_name', 'email', 'phone'],
            include: [{
              model: WoredaAdmin,
              as: 'woreda',
              attributes: ['woreda_name'],
              include: [{
                model: ZoneAdmin,
                as: 'zone',
                attributes: ['zone_name'],
                include: [{
                  model: RegionalAdmin,
                  as: 'regional',
                  attributes: ['region_name']
                }]
              }]
            }]
          });
          
          if (kebele) {
            users = [{
              id: kebele.id,
              full_name: `${kebele.first_name} ${kebele.middle_name ? kebele.middle_name + ' ' : ''}${kebele.last_name}`.trim(),
              first_name: kebele.first_name,
              last_name: kebele.last_name,
              kebele_name: kebele.kebele_name,
              woreda_name: kebele.woreda?.woreda_name,
              zone_name: kebele.woreda?.zone?.zone_name,
              region_name: kebele.woreda?.zone?.regional?.region_name,
              email: kebele.email,
              phone: kebele.phone,
              type: 'kebele',
              is_single: true
            }];
          }
        } else if (woreda_id) {
          // Filter by woreda_id if provided
          whereClause.woreda_id = woreda_id;
          console.log(`🔍 Filtering kebeles by woreda_id: ${woreda_id}`);
          
          const kebeles = await KebeleAdmin.findAll({
            where: whereClause,
            attributes: ['id', 'first_name', 'middle_name', 'last_name', 'kebele_name', 'email', 'phone'],
            include: [{
              model: WoredaAdmin,
              as: 'woreda',
              attributes: ['woreda_name'],
              include: [{
                model: ZoneAdmin,
                as: 'zone',
                attributes: ['zone_name'],
                include: [{
                  model: RegionalAdmin,
                  as: 'regional',
                  attributes: ['region_name']
                }]
              }]
            }]
          });
          
          users = kebeles.map(k => ({
            id: k.id,
            full_name: `${k.first_name} ${k.middle_name ? k.middle_name + ' ' : ''}${k.last_name}`.trim(),
            first_name: k.first_name,
            last_name: k.last_name,
            kebele_name: k.kebele_name,
            woreda_name: k.woreda?.woreda_name,
            zone_name: k.woreda?.zone?.zone_name,
            region_name: k.woreda?.zone?.regional?.region_name,
            email: k.email,
            phone: k.phone,
            type: 'kebele'
          }));
        } else if (regional_id) {
          // If regional_id provided, get kebeles through zones and woredas
          const zones = await ZoneAdmin.findAll({
            where: { regional_id },
            attributes: ['id']
          });
          const zoneIds = zones.map(z => z.id);
          
          if (zoneIds.length > 0) {
            const woredas = await WoredaAdmin.findAll({
              where: { zone_id: { [Op.in]: zoneIds } },
              attributes: ['id']
            });
            const woredaIds = woredas.map(w => w.id);
            
            if (woredaIds.length > 0) {
              whereClause.woreda_id = { [Op.in]: woredaIds };
              console.log(`🔍 Filtering kebeles by woreda_ids: [${woredaIds.join(', ')}]`);
              
              const kebeles = await KebeleAdmin.findAll({
                where: whereClause,
                attributes: ['id', 'first_name', 'middle_name', 'last_name', 'kebele_name', 'email', 'phone'],
                include: [{
                  model: WoredaAdmin,
                  as: 'woreda',
                  attributes: ['woreda_name'],
                  include: [{
                    model: ZoneAdmin,
                    as: 'zone',
                    attributes: ['zone_name'],
                    include: [{
                      model: RegionalAdmin,
                      as: 'regional',
                      attributes: ['region_name']
                    }]
                  }]
                }]
              });
              
              users = kebeles.map(k => ({
                id: k.id,
                full_name: `${k.first_name} ${k.middle_name ? k.middle_name + ' ' : ''}${k.last_name}`.trim(),
                first_name: k.first_name,
                last_name: k.last_name,
                kebele_name: k.kebele_name,
                woreda_name: k.woreda?.woreda_name,
                zone_name: k.woreda?.zone?.zone_name,
                region_name: k.woreda?.zone?.regional?.region_name,
                email: k.email,
                phone: k.phone,
                type: 'kebele'
              }));
            } else {
              return res.json({
                success: true,
                users: [],
                count: 0
              });
            }
          } else {
            return res.json({
              success: true,
              users: [],
              count: 0
            });
          }
        }
        break;

      case 'hospital':
        // Reset whereClause
        whereClause = {};
        
        // If specific id is provided
        if (id) {
          whereClause.id = id;
          console.log(`🔍 Fetching SPECIFIC hospital admin with id: ${id}`);
          
          const hospital = await HospitalAdmin.findOne({
            where: whereClause,
            attributes: ['id', 'first_name', 'middle_name', 'last_name', 'hospital_name', 'email', 'phone'],
            include: [{
              model: KebeleAdmin,
              as: 'kebele',
              attributes: ['kebele_name'],
              include: [{
                model: WoredaAdmin,
                as: 'woreda',
                attributes: ['woreda_name'],
                include: [{
                  model: ZoneAdmin,
                  as: 'zone',
                  attributes: ['zone_name'],
                  include: [{
                    model: RegionalAdmin,
                    as: 'regional',
                    attributes: ['region_name']
                  }]
                }]
              }]
            }]
          });
          
          if (hospital) {
            users = [{
              id: hospital.id,
              full_name: `${hospital.first_name} ${hospital.middle_name ? hospital.middle_name + ' ' : ''}${hospital.last_name}`.trim(),
              first_name: hospital.first_name,
              last_name: hospital.last_name,
              hospital_name: hospital.hospital_name,
              kebele_name: hospital.kebele?.kebele_name,
              woreda_name: hospital.kebele?.woreda?.woreda_name,
              zone_name: hospital.kebele?.woreda?.zone?.zone_name,
              region_name: hospital.kebele?.woreda?.zone?.regional?.region_name,
              email: hospital.email,
              phone: hospital.phone,
              type: 'hospital',
              is_single: true
            }];
          }
        } else if (kebele_id) {
          // Filter by kebele_id if provided
          whereClause.kebele_id = kebele_id;
          console.log(`🔍 Filtering hospitals by kebele_id: ${kebele_id}`);
          
          const hospitals = await HospitalAdmin.findAll({
            where: whereClause,
            attributes: ['id', 'first_name', 'middle_name', 'last_name', 'hospital_name', 'email', 'phone'],
            include: [{
              model: KebeleAdmin,
              as: 'kebele',
              attributes: ['kebele_name'],
              include: [{
                model: WoredaAdmin,
                as: 'woreda',
                attributes: ['woreda_name'],
                include: [{
                  model: ZoneAdmin,
                  as: 'zone',
                  attributes: ['zone_name'],
                  include: [{
                    model: RegionalAdmin,
                    as: 'regional',
                    attributes: ['region_name']
                  }]
                }]
              }]
            }]
          });
          
          users = hospitals.map(h => ({
            id: h.id,
            full_name: `${h.first_name} ${h.middle_name ? h.middle_name + ' ' : ''}${h.last_name}`.trim(),
            first_name: h.first_name,
            last_name: h.last_name,
            hospital_name: h.hospital_name,
            kebele_name: h.kebele?.kebele_name,
            woreda_name: h.kebele?.woreda?.woreda_name,
            zone_name: h.kebele?.woreda?.zone?.zone_name,
            region_name: h.kebele?.woreda?.zone?.regional?.region_name,
            email: h.email,
            phone: h.phone,
            type: 'hospital'
          }));
        } else if (regional_id) {
          // If regional_id provided, get hospitals through zones, woredas, kebeles
          const zones = await ZoneAdmin.findAll({
            where: { regional_id },
            attributes: ['id']
          });
          const zoneIds = zones.map(z => z.id);
          
          if (zoneIds.length > 0) {
            const woredas = await WoredaAdmin.findAll({
              where: { zone_id: { [Op.in]: zoneIds } },
              attributes: ['id']
            });
            const woredaIds = woredas.map(w => w.id);
            
            if (woredaIds.length > 0) {
              const kebeles = await KebeleAdmin.findAll({
                where: { woreda_id: { [Op.in]: woredaIds } },
                attributes: ['id']
              });
              const kebeleIds = kebeles.map(k => k.id);
              
              if (kebeleIds.length > 0) {
                whereClause.kebele_id = { [Op.in]: kebeleIds };
                console.log(`🔍 Filtering hospitals by kebele_ids: [${kebeleIds.join(', ')}]`);
                
                const hospitals = await HospitalAdmin.findAll({
                  where: whereClause,
                  attributes: ['id', 'first_name', 'middle_name', 'last_name', 'hospital_name', 'email', 'phone'],
                  include: [{
                    model: KebeleAdmin,
                    as: 'kebele',
                    attributes: ['kebele_name'],
                    include: [{
                      model: WoredaAdmin,
                      as: 'woreda',
                      attributes: ['woreda_name'],
                      include: [{
                        model: ZoneAdmin,
                        as: 'zone',
                        attributes: ['zone_name'],
                        include: [{
                          model: RegionalAdmin,
                          as: 'regional',
                          attributes: ['region_name']
                        }]
                      }]
                    }]
                  }]
                });
                
                users = hospitals.map(h => ({
                  id: h.id,
                  full_name: `${h.first_name} ${h.middle_name ? h.middle_name + ' ' : ''}${h.last_name}`.trim(),
                  first_name: h.first_name,
                  last_name: h.last_name,
                  hospital_name: h.hospital_name,
                  kebele_name: h.kebele?.kebele_name,
                  woreda_name: h.kebele?.woreda?.woreda_name,
                  zone_name: h.kebele?.woreda?.zone?.zone_name,
                  region_name: h.kebele?.woreda?.zone?.regional?.region_name,
                  email: h.email,
                  phone: h.phone,
                  type: 'hospital'
                }));
              } else {
                return res.json({
                  success: true,
                  users: [],
                  count: 0
                });
              }
            } else {
              return res.json({
                success: true,
                users: [],
                count: 0
              });
            }
          } else {
            return res.json({
              success: true,
              users: [],
              count: 0
            });
          }
        }
        break;

      case 'staff':
        // Reset whereClause
        whereClause = {};
        
        // If specific id is provided
        if (id) {
          whereClause.id = id;
          console.log(`🔍 Fetching SPECIFIC staff with id: ${id}`);
          
          const staffMember = await HospitalStaff.findOne({
            where: whereClause,
            attributes: ['id', 'first_name', 'middle_name', 'last_name', 'department', 'phone', 'email'],
            include: [{
              model: HospitalAdmin,
              as: 'hospital',
              attributes: ['hospital_name'],
              include: [{
                model: KebeleAdmin,
                as: 'kebele',
                attributes: ['kebele_name'],
                include: [{
                  model: WoredaAdmin,
                  as: 'woreda',
                  attributes: ['woreda_name'],
                  include: [{
                    model: ZoneAdmin,
                    as: 'zone',
                    attributes: ['zone_name'],
                    include: [{
                      model: RegionalAdmin,
                      as: 'regional',
                      attributes: ['region_name']
                    }]
                  }]
                }]
              }]
            }]
          });
          
          if (staffMember) {
            users = [{
              id: staffMember.id,
              full_name: `${staffMember.first_name} ${staffMember.middle_name ? staffMember.middle_name + ' ' : ''}${staffMember.last_name}`.trim(),
              first_name: staffMember.first_name,
              last_name: staffMember.last_name,
              department: staffMember.department,
              hospital_name: staffMember.hospital?.hospital_name,
              kebele_name: staffMember.hospital?.kebele?.kebele_name,
              woreda_name: staffMember.hospital?.kebele?.woreda?.woreda_name,
              zone_name: staffMember.hospital?.kebele?.woreda?.zone?.zone_name,
              region_name: staffMember.hospital?.kebele?.woreda?.zone?.regional?.region_name,
              email: staffMember.email,
              phone: staffMember.phone,
              type: 'staff',
              is_single: true
            }];
          }
        } else if (hospital_id) {
          // Filter by hospital_id if provided
          whereClause.hospital_id = hospital_id;
          console.log(`🔍 Filtering staff by hospital_id: ${hospital_id}`);
          
          const staff = await HospitalStaff.findAll({
            where: whereClause,
            attributes: ['id', 'first_name', 'middle_name', 'last_name', 'department', 'phone', 'email'],
            include: [{
              model: HospitalAdmin,
              as: 'hospital',
              attributes: ['hospital_name'],
              include: [{
                model: KebeleAdmin,
                as: 'kebele',
                attributes: ['kebele_name'],
                include: [{
                  model: WoredaAdmin,
                  as: 'woreda',
                  attributes: ['woreda_name'],
                  include: [{
                    model: ZoneAdmin,
                    as: 'zone',
                    attributes: ['zone_name'],
                    include: [{
                      model: RegionalAdmin,
                      as: 'regional',
                      attributes: ['region_name']
                    }]
                  }]
                }]
              }]
            }]
          });
          
          users = staff.map(s => ({
            id: s.id,
            full_name: `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`.trim(),
            first_name: s.first_name,
            last_name: s.last_name,
            department: s.department,
            hospital_name: s.hospital?.hospital_name,
            kebele_name: s.hospital?.kebele?.kebele_name,
            woreda_name: s.hospital?.kebele?.woreda?.woreda_name,
            zone_name: s.hospital?.kebele?.woreda?.zone?.zone_name,
            region_name: s.hospital?.kebele?.woreda?.zone?.regional?.region_name,
            email: s.email,
            phone: s.phone,
            type: 'staff'
          }));
        } else if (regional_id) {
          // If regional_id provided, get staff through zones, woredas, kebeles, hospitals
          const zones = await ZoneAdmin.findAll({
            where: { regional_id },
            attributes: ['id']
          });
          const zoneIds = zones.map(z => z.id);
          
          if (zoneIds.length > 0) {
            const woredas = await WoredaAdmin.findAll({
              where: { zone_id: { [Op.in]: zoneIds } },
              attributes: ['id']
            });
            const woredaIds = woredas.map(w => w.id);
            
            if (woredaIds.length > 0) {
              const kebeles = await KebeleAdmin.findAll({
                where: { woreda_id: { [Op.in]: woredaIds } },
                attributes: ['id']
              });
              const kebeleIds = kebeles.map(k => k.id);
              
              if (kebeleIds.length > 0) {
                const hospitals = await HospitalAdmin.findAll({
                  where: { kebele_id: { [Op.in]: kebeleIds } },
                  attributes: ['id']
                });
                const hospitalIds = hospitals.map(h => h.id);
                
                if (hospitalIds.length > 0) {
                  whereClause.hospital_id = { [Op.in]: hospitalIds };
                  console.log(`🔍 Filtering staff by hospital_ids: [${hospitalIds.join(', ')}]`);
                  
                  const staff = await HospitalStaff.findAll({
                    where: whereClause,
                    attributes: ['id', 'first_name', 'middle_name', 'last_name', 'department', 'phone', 'email'],
                    include: [{
                      model: HospitalAdmin,
                      as: 'hospital',
                      attributes: ['hospital_name'],
                      include: [{
                        model: KebeleAdmin,
                        as: 'kebele',
                        attributes: ['kebele_name'],
                        include: [{
                          model: WoredaAdmin,
                          as: 'woreda',
                          attributes: ['woreda_name'],
                          include: [{
                            model: ZoneAdmin,
                            as: 'zone',
                            attributes: ['zone_name'],
                            include: [{
                              model: RegionalAdmin,
                              as: 'regional',
                              attributes: ['region_name']
                            }]
                          }]
                        }]
                      }]
                    }]
                  });
                  
                  users = staff.map(s => ({
                    id: s.id,
                    full_name: `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`.trim(),
                    first_name: s.first_name,
                    last_name: s.last_name,
                    department: s.department,
                    hospital_name: s.hospital?.hospital_name,
                    kebele_name: s.hospital?.kebele?.kebele_name,
                    woreda_name: s.hospital?.kebele?.woreda?.woreda_name,
                    zone_name: s.hospital?.kebele?.woreda?.zone?.zone_name,
                    region_name: s.hospital?.kebele?.woreda?.zone?.regional?.region_name,
                    email: s.email,
                    phone: s.phone,
                    type: 'staff'
                  }));
                } else {
                  return res.json({
                    success: true,
                    users: [],
                    count: 0
                  });
                }
              } else {
                return res.json({
                  success: true,
                  users: [],
                  count: 0
                });
              }
            } else {
              return res.json({
                success: true,
                users: [],
                count: 0
              });
            }
          } else {
            return res.json({
              success: true,
              users: [],
              count: 0
            });
          }
        }
        break;

      default:
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid level parameter' 
        });
    }

    console.log(`✅ Found ${users.length} users for level: ${level}`);
    
    // Check if this is a single item fetch
    const isSingle = users.length === 1 && users[0]?.is_single === true;

    res.json({
      success: true,
      users,
      count: users.length,
      is_single: isSingle
    });

  } catch (error) {
    console.error('❌ Error fetching users by level:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};