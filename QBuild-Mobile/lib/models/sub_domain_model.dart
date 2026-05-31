import 'package:json_annotation/json_annotation.dart';

part 'sub_domain_model.g.dart';

@JsonSerializable()
class SubDomain {
  final int id;
  final String name;
  final String description;
  final int domainId;
  final String domainName;
  final int weightage;
  final int queries;
  final bool isActive;
  final int order;

  const SubDomain({
    required this.id,
    required this.name,
    required this.description,
    required this.domainId,
    required this.domainName,
    required this.weightage,
    required this.queries,
    required this.isActive,
    required this.order,
  });

  factory SubDomain.fromJson(Map<String, dynamic> json) => _$SubDomainFromJson(json);
  Map<String, dynamic> toJson() => _$SubDomainToJson(this);

  SubDomain copyWith({
    int? id,
    String? name,
    String? description,
    int? domainId,
    String? domainName,
    int? weightage,
    int? queries,
    bool? isActive,
    int? order,
  }) {
    return SubDomain(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      domainId: domainId ?? this.domainId,
      domainName: domainName ?? this.domainName,
      weightage: weightage ?? this.weightage,
      queries: queries ?? this.queries,
      isActive: isActive ?? this.isActive,
      order: order ?? this.order,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SubDomain &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'SubDomain{id: $id, name: $name, domainName: $domainName}';
  }
}

@JsonSerializable()
class Domain {
  final int id;
  final String name;
  final String description;
  final int order;
  final List<SubDomain> subDomains;
  final bool isActive;

  const Domain({
    required this.id,
    required this.name,
    required this.description,
    required this.order,
    required this.subDomains,
    required this.isActive,
  });

  factory Domain.fromJson(Map<String, dynamic> json) => _$DomainFromJson(json);
  Map<String, dynamic> toJson() => _$DomainToJson(this);

  Domain copyWith({
    int? id,
    String? name,
    String? description,
    int? order,
    List<SubDomain>? subDomains,
    bool? isActive,
  }) {
    return Domain(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      order: order ?? this.order,
      subDomains: subDomains ?? this.subDomains,
      isActive: isActive ?? this.isActive,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Domain &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'Domain{id: $id, name: $name, subDomains: ${subDomains.length}}';
  }
}
